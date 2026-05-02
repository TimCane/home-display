/**
 * Lock semantics: pin the display to a specific entry.
 *
 * setLock(entryId) — lock to entry; if different from current lock, push it.
 * clearLock() — remove lock; next tick will pick normally.
 */

import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { systemState } from "../db/schema.js";
import { pushFrame } from "../push/push-frame.js";

export async function setLock(entryId: string): Promise<void> {
  const [state] = await db
    .select({ lockEntryId: systemState.lockEntryId })
    .from(systemState)
    .where(eq(systemState.id, 1));

  await db
    .update(systemState)
    .set({ lockEntryId: entryId })
    .where(eq(systemState.id, 1));

  // Push if locking to a different entry
  if (state.lockEntryId !== entryId) {
    const result = await pushFrame({ entryId, trigger: "lock_change" });
    if (result.ok) {
      await db
        .update(systemState)
        .set({ currentlyDisplayedEntryId: entryId })
        .where(eq(systemState.id, 1));
    }
  }
}

export async function clearLock(): Promise<void> {
  await db
    .update(systemState)
    .set({ lockEntryId: null })
    .where(eq(systemState.id, 1));
}
