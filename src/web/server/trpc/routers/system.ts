import { z } from "zod";
import { eq } from "drizzle-orm";
import { router, adminProcedure } from "../trpc.js";
import { db } from "../../db/index.js";
import { systemState, entries } from "../../db/schema.js";
import { setLock, clearLock } from "../../scheduler/lock.js";
import { emitSystemEvent } from "../../events.js";
import { pushFrame } from "../../push/push-frame.js";
import { encode2bpp, WIDTH, HEIGHT, TOTAL_PIXELS, FRAME_BYTES } from "../../../shared/framebuffer.js";
import { getSetting } from "../../config/settings.js";
import { evaluateAll, type Condition } from "../../../shared/conditions.js";
import { scoreEntry } from "../../scheduler/score.js";
import {
  weightedRandom,
  mulberry32,
  dailySeed,
  type ScoredCandidate,
} from "../../scheduler/select.js";

export const systemRouter = router({
  /** Current system_state row. */
  getState: adminProcedure.query(async () => {
    const [state] = await db
      .select()
      .from(systemState)
      .where(eq(systemState.id, 1));
    return state;
  }),

  /** Pin display to an entry. */
  lock: adminProcedure
    .input(z.object({ entryId: z.string().uuid() }))
    .mutation(async ({ input }) => {
      await setLock(input.entryId);
      return { ok: true };
    }),

  /** Remove display lock. */
  unlock: adminProcedure.mutation(async () => {
    await clearLock();
    return { ok: true };
  }),

  /** Set a manual flag on system_state.flags. */
  setFlag: adminProcedure
    .input(z.object({ name: z.string().min(1), value: z.boolean() }))
    .mutation(async ({ input }) => {
      const [state] = await db
        .select({ flags: systemState.flags })
        .from(systemState)
        .where(eq(systemState.id, 1));

      const flags = { ...(state.flags as Record<string, boolean>) };
      flags[input.name] = input.value;

      await db
        .update(systemState)
        .set({ flags })
        .where(eq(systemState.id, 1));

      emitSystemEvent({
        type: "flag_change",
        payload: { flag: input.name, value: input.value },
      });

      return { ok: true };
    }),

  /** Generate a 4-quadrant test pattern and push it (no entries row). */
  pushTestPattern: adminProcedure.mutation(async () => {
    // Build test pattern: 4 quadrants, each a different palette index
    const indices = new Uint8Array(TOTAL_PIXELS);
    const halfW = WIDTH / 2;
    const halfH = HEIGHT / 2;

    for (let y = 0; y < HEIGHT; y++) {
      for (let x = 0; x < WIDTH; x++) {
        const quadrant =
          y < halfH ? (x < halfW ? 0 : 1) : x < halfW ? 2 : 3;
        indices[y * WIDTH + x] = quadrant;
      }
    }

    const framebuffer = Buffer.from(encode2bpp(indices));

    // Push directly to display without creating an entry
    const { getSetting } = await import("../../config/settings.js");
    const baseUrl = await getSetting("display_base_url");
    const token = await getSetting("display_token");

    const res = await fetch(`${baseUrl}/fb`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/octet-stream",
        "Content-Length": String(FRAME_BYTES),
      },
      body: new Uint8Array(framebuffer),
    });

    const ok = res.ok;
    return { ok };
  }),

  /**
   * Simulate the next N scheduler ticks to preview which entries will
   * be selected. Uses a seeded PRNG so the preview is deterministic
   * within the same UTC day.
   */
  upcoming: adminProcedure
    .input(z.object({ count: z.number().int().min(1).max(20).default(5) }).optional())
    .query(async ({ input }) => {
      const count = input?.count ?? 5;

      const [state] = await db
        .select()
        .from(systemState)
        .where(eq(systemState.id, 1));

      // Fetch all enabled entries (without framebuffer)
      const allEntries = await db
        .select({
          id: entries.id,
          title: entries.title,
          baseWeight: entries.baseWeight,
          conditions: entries.conditions,
          lastShownAt: entries.lastShownAt,
          showCount: entries.showCount,
          updatedAt: entries.updatedAt,
        })
        .from(entries)
        .where(eq(entries.enabled, true));

      if (allEntries.length === 0) return [];

      const now = new Date();
      const tz = await getSetting("app_tz");
      const halfLifeH = await getSetting("decay_half_life_hours");
      const firstViewBoost = await getSetting("first_view_boost");
      const flags = (state.flags ?? {}) as Record<string, boolean>;

      // Create a seeded RNG for simulation — offset from the daily seed
      // so the upcoming preview doesn't consume the same sequence as the
      // real scheduler.
      const rng = mulberry32(dailySeed(now) + 999);

      // Simulate entry state (mutable copies for lastShownAt / showCount)
      const sim = allEntries.map((e) => ({
        ...e,
        lastShownAt: e.lastShownAt ? new Date(e.lastShownAt) : null,
        showCount: e.showCount,
      }));

      let currentId = state.currentlyDisplayedEntryId;
      const result: { id: string; title: string }[] = [];

      for (let i = 0; i < count; i++) {
        // Filter eligible (exclude current, evaluate conditions)
        const eligible = sim.filter((row) => {
          if (row.id === currentId) return false;
          const conds = (row.conditions ?? []) as Condition[];
          return evaluateAll(conds, {
            now,
            tz,
            entry: { lastShownAt: row.lastShownAt, updatedAt: row.updatedAt },
            flags,
          });
        });

        if (eligible.length === 0) break;

        const scored: ScoredCandidate<(typeof eligible)[0]>[] = eligible.map(
          (row) => ({
            item: row,
            score: scoreEntry(
              row.baseWeight,
              row.lastShownAt,
              row.showCount,
              halfLifeH,
              firstViewBoost,
              now,
            ),
          }),
        );

        const winner = weightedRandom(scored, rng);
        if (!winner) break;

        result.push({ id: winner.id, title: winner.title });

        // Update simulated state so the next tick excludes/deprioritises this entry
        winner.lastShownAt = now;
        winner.showCount += 1;
        currentId = winner.id;
      }

      return result;
    }),
});
