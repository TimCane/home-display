/**
 * Display-now: one-shot push that bypasses scheduling rules.
 *
 * Works on disabled entries, unmatched conditions, and while locked.
 * If locked, updates the lock pointer to stay in sync.
 */

import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { entries, systemState } from "../db/schema.js";
import { pushFrame } from "../push/push-frame.js";

export async function displayNow(entryId: string): Promise<void> {
  // Verify entry exists (no enabled / conditions check)
  const [entry] = await db
    .select({ id: entries.id })
    .from(entries)
    .where(eq(entries.id, entryId));

  if (!entry) {
    throw new Error(`Entry ${entryId} not found`);
  }

  const result = await pushFrame({ entryId, trigger: "display_now" });

  if (result.ok) {
    const [state] = await db
      .select({ lockEntryId: systemState.lockEntryId })
      .from(systemState)
      .where(eq(systemState.id, 1));

    const updates: Record<string, unknown> = {
      currentlyDisplayedEntryId: entryId,
    };

    // If currently locked, update lock pointer to stay in sync
    if (state.lockEntryId !== null) {
      updates.lockEntryId = entryId;
    }

    await db.update(systemState).set(updates).where(eq(systemState.id, 1));

    await db
      .update(entries)
      .set({ lastShownAt: new Date() })
      .where(eq(entries.id, entryId));
  }
}
