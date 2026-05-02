/**
 * Confirmation polling: after firmware returns "accepted", poll GET /status
 * every 5s for up to 90s, watching last_refresh_uptime_s.
 */

export let POLL_INTERVAL_MS = 5_000;
export let POLL_TIMEOUT_MS = 90_000;

/** Override poll timing (for tests). */
export function setPollTiming(intervalMs: number, timeoutMs: number): void {
  POLL_INTERVAL_MS = intervalMs;
  POLL_TIMEOUT_MS = timeoutMs;
}

/** Reset to production defaults. */
export function resetPollTiming(): void {
  POLL_INTERVAL_MS = 5_000;
  POLL_TIMEOUT_MS = 90_000;
}

export interface ConfirmResult {
  confirmed: boolean;
  panelUptimeAfter: number | null;
}

export async function pollConfirmation(
  baseUrl: string,
  token: string,
  preUptimeS: number
): Promise<ConfirmResult> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;

  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS);

    try {
      const res = await fetch(`${baseUrl}/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) continue;

      const status = (await res.json()) as { last_refresh_uptime_s: number };
      if (status.last_refresh_uptime_s > preUptimeS) {
        return { confirmed: true, panelUptimeAfter: status.last_refresh_uptime_s };
      }
    } catch {
      // Network error during poll — keep trying until deadline
    }
  }

  // Timed out — firmware accepted but didn't confirm refresh
  return { confirmed: false, panelUptimeAfter: null };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
