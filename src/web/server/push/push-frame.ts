import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { entries } from "../db/schema.js";
import { getSetting } from "../config/settings.js";
import { acquireSlot, releaseSlot } from "./in-flight.js";
import { insertPushLog } from "./log.js";
import { pollConfirmation } from "./confirm.js";

// Retry constants — not in app_settings per spec
const RETRY_BACKOFFS_MS = [1_000, 4_000, 10_000];
const MAX_ATTEMPTS = 3;

export interface PushResult {
  ok: boolean;
  reason?: string;
  firmwareStatus?: string;
}

export async function pushFrame(opts: {
  entryId: string;
  trigger: string;
}): Promise<PushResult> {
  const { entryId, trigger } = opts;

  // In-flight check
  if (!acquireSlot()) {
    await insertPushLog({
      entryId,
      succeeded: false,
      firmwareStatus: "dropped",
      error: "in-flight collision",
      trigger,
    });
    return { ok: false, reason: "in-flight" };
  }

  try {
    return await doPush(entryId, trigger);
  } finally {
    releaseSlot();
  }
}

async function doPush(
  entryId: string,
  trigger: string
): Promise<PushResult> {
  // Load framebuffer
  const row = await db
    .select({ framebuffer: entries.framebuffer })
    .from(entries)
    .where(eq(entries.id, entryId))
    .limit(1);

  if (row.length === 0) {
    await insertPushLog({
      entryId,
      succeeded: false,
      error: "entry not found",
      trigger,
    });
    return { ok: false, reason: "entry not found" };
  }

  const framebuffer = row[0].framebuffer;
  const baseUrl = await getSetting("display_base_url");
  const token = await getSetting("display_token");

  // Get pre-push uptime for confirmation comparison
  let preUptimeS = 0;
  try {
    const statusRes = await fetch(`${baseUrl}/status`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (statusRes.ok) {
      const status = (await statusRes.json()) as { last_refresh_uptime_s: number };
      preUptimeS = status.last_refresh_uptime_s;
    }
  } catch {
    // If we can't get pre-push status, we'll just use 0
  }

  // Retry loop
  let lastError: string | undefined;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      await sleep(RETRY_BACKOFFS_MS[attempt - 1]);
    }

    try {
      const res = await fetch(`${baseUrl}/fb`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/octet-stream",
          "Content-Length": String(framebuffer.length),
        },
        body: new Uint8Array(framebuffer),
      });

      if (res.ok) {
        const body = (await res.json()) as { status: string };

        if (body.status === "accepted") {
          // Poll for confirmation
          const confirm = await pollConfirmation(baseUrl, token, preUptimeS);
          const firmwareStatus = confirm.confirmed ? "accepted" : "unconfirmed";

          await insertPushLog({
            entryId,
            succeeded: true,
            firmwareStatus,
            panelUptimeAfter: confirm.panelUptimeAfter,
            trigger,
          });
          return { ok: true, firmwareStatus };
        }

        if (body.status === "queued") {
          await insertPushLog({
            entryId,
            succeeded: true,
            firmwareStatus: "queued",
            trigger,
          });
          return { ok: true, firmwareStatus: "queued" };
        }

        // Unexpected 2xx status
        lastError = `unexpected firmware status: ${body.status}`;
      } else if (res.status === 503) {
        // Transient — retry
        lastError = "503 Service Unavailable";
        continue;
      } else {
        // Non-retryable error
        const errText = await res.text().catch(() => "");
        lastError = `HTTP ${res.status}: ${errText}`;
        await insertPushLog({
          entryId,
          succeeded: false,
          firmwareStatus: String(res.status),
          error: lastError,
          trigger,
        });
        return { ok: false, reason: lastError };
      }
    } catch (err) {
      // Network error — retry
      lastError = err instanceof Error ? err.message : String(err);
      continue;
    }
  }

  // All retries exhausted
  await insertPushLog({
    entryId,
    succeeded: false,
    error: lastError ?? "all retries failed",
    trigger,
  });
  return { ok: false, reason: lastError ?? "all retries failed" };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
