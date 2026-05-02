import { z } from "zod";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, adminProcedure } from "../trpc.js";
import { entries, generatorInstances } from "../../db/schema.js";
import { conditionsArraySchema } from "../../../shared/conditions.js";
import { displayNow } from "../../scheduler/display-now.js";

export const entryRouter = router({
  /** List all entries with metadata (no framebuffer bytes). */
  list: adminProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select({
        id: entries.id,
        source: entries.source,
        title: entries.title,
        submitterName: entries.submitterName,
        enabled: entries.enabled,
        baseWeight: entries.baseWeight,
        conditions: entries.conditions,
        lastShownAt: entries.lastShownAt,
        showCount: entries.showCount,
        createdAt: entries.createdAt,
        updatedAt: entries.updatedAt,
      })
      .from(entries);
  }),

  /** Get single entry metadata. */
  get: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [entry] = await ctx.db
        .select({
          id: entries.id,
          source: entries.source,
          title: entries.title,
          submitterName: entries.submitterName,
          enabled: entries.enabled,
          baseWeight: entries.baseWeight,
          conditions: entries.conditions,
          lastShownAt: entries.lastShownAt,
          showCount: entries.showCount,
          createdAt: entries.createdAt,
          updatedAt: entries.updatedAt,
        })
        .from(entries)
        .where(eq(entries.id, input.id));

      if (!entry) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Entry not found" });
      }
      return entry;
    }),

  /** Update admin-editable fields on an entry. */
  update: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        enabled: z.boolean().optional(),
        baseWeight: z.number().int().positive().optional(),
        conditions: conditionsArraySchema.optional(),
        title: z.string().min(1).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...patch } = input;

      // If title is being set, reject for generator-owned entries
      if (patch.title !== undefined) {
        const [gen] = await ctx.db
          .select({ id: generatorInstances.id })
          .from(generatorInstances)
          .where(eq(generatorInstances.entryId, id))
          .limit(1);

        if (gen) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Cannot change title of generator-owned entry",
          });
        }
      }

      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (patch.enabled !== undefined) updates.enabled = patch.enabled;
      if (patch.baseWeight !== undefined) updates.baseWeight = patch.baseWeight;
      if (patch.conditions !== undefined) updates.conditions = patch.conditions;
      if (patch.title !== undefined) updates.title = patch.title;

      const [updated] = await ctx.db
        .update(entries)
        .set(updates)
        .where(eq(entries.id, id))
        .returning({ id: entries.id });

      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Entry not found" });
      }
      return updated;
    }),

  /** Hard-delete an entry. Reject if generator-owned. */
  delete: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [gen] = await ctx.db
        .select({ id: generatorInstances.id })
        .from(generatorInstances)
        .where(eq(generatorInstances.entryId, input.id))
        .limit(1);

      if (gen) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot delete generator-owned entry; delete the instance instead",
        });
      }

      const [deleted] = await ctx.db
        .delete(entries)
        .where(eq(entries.id, input.id))
        .returning({ id: entries.id });

      if (!deleted) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Entry not found" });
      }
      return { id: deleted.id };
    }),

  /** One-shot push bypassing scheduling. */
  displayNow: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      await displayNow(input.id);
      return { ok: true };
    }),
});
