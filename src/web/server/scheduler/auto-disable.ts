/**
 * Auto-disable sweep: every 10 min, scan entries for date_range conditions
 * with a `to` date strictly before today. Flip enabled = false on those entries.
 *
 * V1 detects one shape: date_range with `to` in the past and no future `from`.
 */

import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { entries } from "../db/schema.js";
import { getSetting } from "../config/settings.js";
import type { Condition } from "../../shared/conditions.js";

export async function autoDisableSweep(): Promise<void> {
  const tz = await getSetting("app_tz");
  const today = todayStr(tz);

  const rows = await db
    .select({
      id: entries.id,
      conditions: entries.conditions,
    })
    .from(entries)
    .where(eq(entries.enabled, true));

  let disabledCount = 0;

  for (const row of rows) {
    const conds = (row.conditions ?? []) as Condition[];
    if (shouldAutoDisable(conds, today)) {
      await db
        .update(entries)
        .set({ enabled: false })
        .where(eq(entries.id, row.id));
      disabledCount++;
    }
  }

  if (disabledCount > 0) {
    console.log(`[scheduler] Auto-disabled ${disabledCount} entries`);
  }
}

function shouldAutoDisable(conditions: Condition[], today: string): boolean {
  for (const c of conditions) {
    if (c.type !== "date_range") continue;
    const { from, to } = c.params;
    // Has a `to` in the past
    if (to && to < today) {
      // And no `from` in the future that would make a different date_range relevant
      if (!from || from <= today) {
        return true;
      }
    }
  }
  return false;
}

function todayStr(tz: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")!.value;
  const mo = parts.find((p) => p.type === "month")!.value;
  const d = parts.find((p) => p.type === "day")!.value;
  return `${y}-${mo}-${d}`;
}
