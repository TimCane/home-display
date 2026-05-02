/**
 * Scheduler tick: select one entry and push it to the display.
 *
 * If locked → bump last_shown_at on the locked entry, skip selection.
 * Otherwise → filter candidates, score, weighted-random pick, push.
 */

import { eq, ne, and, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { entries, systemState } from "../db/schema.js";
import { getSetting } from "../config/settings.js";
import { evaluateAll, type Condition } from "../../shared/conditions.js";
import { scoreEntry } from "./score.js";
import { weightedRandom, type ScoredCandidate } from "./select.js";
import { pushFrame } from "../push/push-frame.js";

export async function tick(): Promise<void> {
  const [state] = await db
    .select()
    .from(systemState)
    .where(eq(systemState.id, 1));

  // ── Locked: bump last_shown_at, skip selection ──
  if (state.lockEntryId) {
    await db
      .update(entries)
      .set({ lastShownAt: new Date() })
      .where(eq(entries.id, state.lockEntryId));
    console.log(`[scheduler] Locked to ${state.lockEntryId}, bumped last_shown_at`);
    return;
  }

  // ── Build candidate set ──
  const conditions: ReturnType<typeof eq>[] = [eq(entries.enabled, true)];
  if (state.currentlyDisplayedEntryId) {
    conditions.push(ne(entries.id, state.currentlyDisplayedEntryId));
  }

  const rows = await db
    .select({
      id: entries.id,
      baseWeight: entries.baseWeight,
      conditions: entries.conditions,
      lastShownAt: entries.lastShownAt,
      showCount: entries.showCount,
      updatedAt: entries.updatedAt,
    })
    .from(entries)
    .where(and(...conditions));

  // ── Filter by conditions ──
  const now = new Date();
  const tz = await getSetting("app_tz");
  const flags = (state.flags ?? {}) as Record<string, boolean>;

  const eligible = rows.filter((row) => {
    const conds = (row.conditions ?? []) as Condition[];
    return evaluateAll(conds, {
      now,
      tz,
      entry: {
        lastShownAt: row.lastShownAt,
        updatedAt: row.updatedAt,
      },
      flags,
    });
  });

  if (eligible.length === 0) {
    console.log("[scheduler] No candidates");
    return;
  }

  // ── Score & select ──
  const halfLifeH = await getSetting("decay_half_life_hours");
  const firstViewBoost = await getSetting("first_view_boost");

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

  const winner = weightedRandom(scored);
  if (!winner) {
    console.log("[scheduler] Weighted random returned null");
    return;
  }

  // ── Push ──
  const result = await pushFrame({ entryId: winner.id, trigger: "tick" });

  if (result.ok) {
    await db
      .update(entries)
      .set({
        lastShownAt: new Date(),
        showCount: sql`${entries.showCount} + 1`,
      })
      .where(eq(entries.id, winner.id));

    await db
      .update(systemState)
      .set({ currentlyDisplayedEntryId: winner.id })
      .where(eq(systemState.id, 1));

    console.log(`[scheduler] Pushed entry ${winner.id}`);
  } else {
    console.log(`[scheduler] Push failed for ${winner.id}: ${result.reason}`);
  }
}
