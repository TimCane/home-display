import { z } from "zod";
import { eq, and, isNull, isNotNull, gt, lte, count } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, adminProcedure, publicProcedure } from "../trpc.js";
import { entries, entryDrafts } from "../../db/schema.js";
import { conditionsArraySchema } from "../../../shared/conditions.js";
import { draftGate } from "../../auth/draft-gate.js";
import { FRAME_BYTES } from "../../../shared/framebuffer.js";

const allowedElementsSchema = z
  .array(z.enum(["image_upload", "text", "rect", "line", "circle", "icon"]))
  .min(1);

export const draftRouter = router({
  /** Create a new draft (admin-only). */
  create: adminProcedure
    .input(
      z.object({
        guestMode: z.boolean().default(false),
        submitterName: z.string().min(1).optional(),
        allowedElements: allowedElementsSchema.optional(),
        enabled: z.boolean().optional(),
        baseWeight: z.number().int().positive().optional(),
        conditions: conditionsArraySchema.optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      const [draft] = await ctx.db
        .insert(entryDrafts)
        .values({
          expiresAt,
          guestMode: input.guestMode,
          submitterName: input.submitterName ?? null,
          allowedElements: input.allowedElements ?? ["image_upload"],
          enabled: input.enabled ?? true,
          baseWeight: input.baseWeight ?? 1,
          conditions: input.conditions ?? [],
        })
        .returning({ id: entryDrafts.id });

      return { id: draft.id };
    }),

  /** List drafts with optional status filter and pagination (admin-only). */
  list: adminProcedure
    .input(
      z.object({
        filter: z
          .enum(["unconsumed", "consumed", "expired", "all"])
          .default("unconsumed"),
        skip: z.number().int().min(0).default(0),
        take: z.number().int().min(1).max(100).default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      const now = new Date();
      const conditions = [];

      switch (input.filter) {
        case "unconsumed":
          conditions.push(isNull(entryDrafts.consumedAt));
          conditions.push(gt(entryDrafts.expiresAt, now));
          break;
        case "consumed":
          conditions.push(isNotNull(entryDrafts.consumedAt));
          break;
        case "expired":
          conditions.push(isNull(entryDrafts.consumedAt));
          conditions.push(lte(entryDrafts.expiresAt, now));
          break;
        case "all":
          break;
      }

      const whereClause =
        conditions.length > 0 ? and(...conditions) : undefined;

      const [items, [{ total }]] = await Promise.all([
        ctx.db
          .select({
            id: entryDrafts.id,
            createdAt: entryDrafts.createdAt,
            expiresAt: entryDrafts.expiresAt,
            consumedAt: entryDrafts.consumedAt,
            guestMode: entryDrafts.guestMode,
            submitterName: entryDrafts.submitterName,
            allowedElements: entryDrafts.allowedElements,
            enabled: entryDrafts.enabled,
            baseWeight: entryDrafts.baseWeight,
            conditions: entryDrafts.conditions,
          })
          .from(entryDrafts)
          .where(whereClause)
          .orderBy(entryDrafts.createdAt)
          .limit(input.take)
          .offset(input.skip),
        ctx.db
          .select({ total: count() })
          .from(entryDrafts)
          .where(whereClause),
      ]);

      return { items, total };
    }),

  /** Get a single draft (public; gated by draftGate). */
  get: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { draft } = await draftGate(input.id, ctx.session);

      return {
        id: draft.id,
        createdAt: draft.createdAt,
        expiresAt: draft.expiresAt,
        guestMode: draft.guestMode,
        submitterName: draft.submitterName,
        allowedElements: draft.allowedElements,
        enabled: draft.enabled,
        baseWeight: draft.baseWeight,
        conditions: draft.conditions,
      };
    }),

  /** Revoke a draft (admin-only). Sets consumed_at to now. */
  revoke: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(entryDrafts)
        .set({ consumedAt: new Date() })
        .where(eq(entryDrafts.id, input.id))
        .returning({ id: entryDrafts.id });

      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Draft not found",
        });
      }

      return { id: updated.id };
    }),

  /**
   * Commit a draft — creates an entries row from the draft + framebuffer.
   * Gated by draftGate (public with UUID; non-guest requires admin session).
   *
   * The framebuffer is uploaded separately via POST /api/draft/:id/commit
   * (raw bytes). This tRPC procedure accepts a base64-encoded frame as a
   * fallback for smaller payloads or testing.
   */
  commit: publicProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        title: z.string().min(1),
        frame: z.string().min(1), // base64-encoded framebuffer
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { draft } = await draftGate(input.id, ctx.session);

      const frameBuffer = Buffer.from(input.frame, "base64");
      if (frameBuffer.length !== FRAME_BYTES) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Frame must be exactly ${FRAME_BYTES} bytes, got ${frameBuffer.length}`,
        });
      }

      // Atomic: re-check draft is still unconsumed, then create entry + consume draft
      const [entry] = await ctx.db.transaction(async (tx) => {
        // Re-check: draft not consumed and not expired
        const [fresh] = await tx
          .select({
            consumedAt: entryDrafts.consumedAt,
            expiresAt: entryDrafts.expiresAt,
          })
          .from(entryDrafts)
          .where(eq(entryDrafts.id, draft.id))
          .for("update");

        if (fresh.consumedAt) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Draft has already been used",
          });
        }
        if (fresh.expiresAt < new Date()) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Draft has expired",
          });
        }

        const created = await tx
          .insert(entries)
          .values({
            source: draft.guestMode ? "guest" : "admin",
            title: input.title,
            submitterName: draft.submitterName,
            framebuffer: frameBuffer,
            enabled: draft.enabled,
            baseWeight: draft.baseWeight,
            conditions: draft.conditions,
            showCount: 0,
          })
          .returning({ id: entries.id });

        await tx
          .update(entryDrafts)
          .set({ consumedAt: new Date() })
          .where(eq(entryDrafts.id, draft.id));

        return created;
      });

      return { entryId: entry.id };
    }),
});
