import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { displayStatusHistory, systemState } from "../db/schema.js";
import { getSetting } from "../config/settings.js";
import { emitSystemEvent } from "../events.js";
import { logger } from "../logger.js";

// Change listeners for SSE (step 13)
type DisplayStatusListener = (online: boolean) => void;
const statusListeners: DisplayStatusListener[] = [];

export function onDisplayStatusChange(fn: DisplayStatusListener): void {
  statusListeners.push(fn);
}

/**
 * Single-shot health poll: GET /status from the display,
 * record result, and update system_state on transitions.
 */
export async function poll(): Promise<void> {
  const baseUrl = await getSetting("display_base_url");
  const token = await getSetting("display_token");

  let reachable = false;
  let status: unknown = null;

  try {
    const res = await fetch(`${baseUrl}/status`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) {
      reachable = true;
      status = await res.json();
    }
  } catch {
    // Network error or timeout — not reachable
  }

  // Insert history row
  await db.insert(displayStatusHistory).values({
    reachable,
    status: status as Record<string, unknown> | null,
  });

  // Check current state and update on transition
  const [state] = await db
    .select({
      displayOnline: systemState.displayOnline,
    })
    .from(systemState)
    .where(eq(systemState.id, 1))
    .limit(1);

  if (state && state.displayOnline !== reachable) {
    await db
      .update(systemState)
      .set({
        displayOnline: reachable,
        displayOnlineSince: new Date(),
      })
      .where(eq(systemState.id, 1));

    for (const fn of statusListeners) {
      fn(reachable);
    }

    emitSystemEvent({
      type: "display_online",
      payload: { online: reachable },
    });

    logger.info({ online: reachable }, "Display status transitioned");
  }
}
