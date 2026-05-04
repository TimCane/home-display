import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { router, adminProcedure } from "../trpc.js";
import {
  pushLog,
  displayStatusHistory,
  generatorRuns,
} from "../../db/schema.js";

export const diagnosticsRouter = router({
  /** Last N push_log rows, newest first. */
  recentPushes: adminProcedure
    .input(z.object({ limit: z.number().int().positive().default(50) }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select()
        .from(pushLog)
        .orderBy(desc(pushLog.attemptedAt))
        .limit(input.limit);
    }),

  /** Last N display_status_history rows, newest first. */
  statusHistory: adminProcedure
    .input(z.object({ limit: z.number().int().positive().default(50) }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select()
        .from(displayStatusHistory)
        .orderBy(desc(displayStatusHistory.polledAt))
        .limit(input.limit);
    }),

  /** Most recent display_status_history.status JSON. */
  latestStatus: adminProcedure.query(async ({ ctx }) => {
    const [row] = await ctx.db
      .select({ status: displayStatusHistory.status })
      .from(displayStatusHistory)
      .orderBy(desc(displayStatusHistory.polledAt))
      .limit(1);

    return row?.status ?? null;
  }),

  /** Last N generator_runs rows, optionally filtered by instanceId. */
  generatorRuns: adminProcedure
    .input(
      z.object({
        instanceId: z.string().uuid().optional(),
        limit: z.number().int().positive().default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      let query = ctx.db
        .select()
        .from(generatorRuns)
        .orderBy(desc(generatorRuns.ranAt))
        .limit(input.limit);

      if (input.instanceId) {
        query = query.where(
          eq(generatorRuns.instanceId, input.instanceId),
        ) as typeof query;
      }

      return query;
    }),
});
