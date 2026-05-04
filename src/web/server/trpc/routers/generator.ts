import { z } from "zod";
import * as cron from "node-cron";
import { eq, desc, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, adminProcedure } from "../trpc.js";
import { entries, generatorInstances, generatorRuns } from "../../db/schema.js";
import { listPlugins, getPlugin } from "../../generators/registry.js";
import {
  registerInstance,
  unregisterInstance,
  reregisterInstance,
  runNow,
} from "../../generators/runtime.js";
import { FRAME_BYTES } from "../../../shared/framebuffer.js";

export const generatorRouter = router({
  /** List all registered plugins with their renderer names and config schema. */
  listPlugins: adminProcedure.query(() => {
    return listPlugins().map((p) => ({
      name: p.name,
      renderers: Object.keys(p.renderers),
      configSchemaJson: p.configSchema.toJSONSchema(),
    }));
  }),

  /** List all generator instances with their last run summary. */
  listInstances: adminProcedure.query(async ({ ctx }) => {
    const instances = await ctx.db
      .select()
      .from(generatorInstances);

    // Fetch last run per instance
    const result = await Promise.all(
      instances.map(async (inst) => {
        const [lastRun] = await ctx.db
          .select()
          .from(generatorRuns)
          .where(eq(generatorRuns.instanceId, inst.id))
          .orderBy(desc(generatorRuns.ranAt))
          .limit(1);

        return { ...inst, lastRun: lastRun ?? null };
      }),
    );

    return result;
  }),

  /** Create a new generator instance + its placeholder entry. */
  createInstance: adminProcedure
    .input(
      z.object({
        plugin: z.string().min(1),
        renderer: z.string().min(1),
        instanceName: z.string().min(1),
        config: z.record(z.string(), z.unknown()),
        cronExpr: z.string().min(1).refine((v) => cron.validate(v), {
          message: "Invalid cron expression",
        }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const plugin = getPlugin(input.plugin);
      if (!plugin) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Plugin "${input.plugin}" not registered`,
        });
      }

      if (!(input.renderer in plugin.renderers)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Renderer "${input.renderer}" not found on plugin "${input.plugin}"`,
        });
      }

      // Validate config against plugin schema
      const parseResult = plugin.configSchema.safeParse(input.config);
      if (!parseResult.success) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Invalid config: ${parseResult.error.message}`,
        });
      }

      // Create placeholder entry (enabled=false, blank framebuffer)
      const blankFramebuffer = Buffer.alloc(FRAME_BYTES, 0);
      const [entry] = await ctx.db
        .insert(entries)
        .values({
          source: "generator",
          title: input.instanceName,
          framebuffer: blankFramebuffer,
          enabled: false,
          baseWeight: 1,
          conditions: [],
        })
        .returning({ id: entries.id });

      // Create generator instance
      const [instance] = await ctx.db
        .insert(generatorInstances)
        .values({
          pluginName: input.plugin,
          renderer: input.renderer,
          instanceName: input.instanceName,
          config: input.config,
          cronExpr: input.cronExpr,
          entryId: entry.id,
        })
        .returning();

      // Register cron
      registerInstance({ id: instance.id, cronExpr: instance.cronExpr });

      return instance;
    }),

  /** Update an existing generator instance. */
  updateInstance: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        instanceName: z.string().min(1).optional(),
        config: z.record(z.string(), z.unknown()).optional(),
        cronExpr: z.string().min(1).refine((v) => cron.validate(v), {
          message: "Invalid cron expression",
        }).optional(),
        renderer: z.string().min(1).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db
        .select()
        .from(generatorInstances)
        .where(eq(generatorInstances.id, input.id));

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Instance not found" });
      }

      const plugin = getPlugin(existing.pluginName);

      // Validate renderer if changing
      if (input.renderer && plugin && !(input.renderer in plugin.renderers)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Renderer "${input.renderer}" not found on plugin "${existing.pluginName}"`,
        });
      }

      // Validate config if changing
      if (input.config && plugin) {
        const parseResult = plugin.configSchema.safeParse(input.config);
        if (!parseResult.success) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Invalid config: ${parseResult.error.message}`,
          });
        }
      }

      const updates: Record<string, unknown> = {};
      if (input.instanceName !== undefined) updates.instanceName = input.instanceName;
      if (input.config !== undefined) updates.config = input.config;
      if (input.cronExpr !== undefined) updates.cronExpr = input.cronExpr;
      if (input.renderer !== undefined) updates.renderer = input.renderer;

      const [updated] = await ctx.db
        .update(generatorInstances)
        .set(updates)
        .where(eq(generatorInstances.id, input.id))
        .returning();

      // Update entry title if instance name changed
      if (input.instanceName !== undefined) {
        await ctx.db
          .update(entries)
          .set({ title: input.instanceName, updatedAt: new Date() })
          .where(eq(entries.id, existing.entryId));
      }

      // Re-register cron (handles cronExpr changes)
      reregisterInstance({ id: updated.id, cronExpr: updated.cronExpr });

      return updated;
    }),

  /** Delete a generator instance and its owned entry. */
  deleteInstance: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [instance] = await ctx.db
        .select()
        .from(generatorInstances)
        .where(eq(generatorInstances.id, input.id));

      if (!instance) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Instance not found" });
      }

      // Unregister cron first
      unregisterInstance(input.id);

      // Delete the entry (cascade will remove the instance via FK)
      await ctx.db
        .delete(entries)
        .where(eq(entries.id, instance.entryId));

      return { id: input.id };
    }),

  /** Trigger an immediate run outside the cron schedule. */
  runNow: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [instance] = await ctx.db
        .select({ id: generatorInstances.id })
        .from(generatorInstances)
        .where(eq(generatorInstances.id, input.id));

      if (!instance) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Instance not found" });
      }

      await runNow(input.id);
      return { ok: true };
    }),

  /** Recent runs for a specific instance. */
  recentRuns: adminProcedure
    .input(
      z.object({
        instanceId: z.string().uuid(),
        limit: z.number().int().positive().default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select()
        .from(generatorRuns)
        .where(eq(generatorRuns.instanceId, input.instanceId))
        .orderBy(desc(generatorRuns.ranAt))
        .limit(input.limit);
    }),
});
