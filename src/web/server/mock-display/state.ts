/**
 * In-memory state for the mock display, mirroring the firmware's status shape.
 */

const COOLDOWN_S = 300; // 5 minutes
const TICK_INTERVAL_MS = 1_000;

export interface DisplayState {
  busy: boolean;
  cooldown_remaining_s: number;
  last_refresh_uptime_s: number;
  last_refresh_timed_out: boolean;
  uptime_s: number;
  free_heap: number;
  rssi: number;
  pending_frame: boolean;
}

let lastFrame: Buffer | null = null;
let pendingFrame: Buffer | null = null;
let uptimeS = 0;
let lastRefreshUptimeS = 0;
let cooldownRemainingS = 0;
let tickHandle: ReturnType<typeof setInterval> | null = null;

export function getState(): DisplayState {
  return {
    busy: false,
    cooldown_remaining_s: cooldownRemainingS,
    last_refresh_uptime_s: lastRefreshUptimeS,
    last_refresh_timed_out: false,
    uptime_s: uptimeS,
    free_heap: 180_000,
    rssi: -42,
    pending_frame: pendingFrame !== null,
  };
}

export function getLastFrame(): Buffer | null {
  return lastFrame;
}

/**
 * Accept a framebuffer push. Returns "accepted" or "queued".
 */
export function pushFrame(data: Buffer): "accepted" | "queued" {
  if (cooldownRemainingS > 0) {
    pendingFrame = data;
    return "queued";
  }
  applyFrame(data);
  return "accepted";
}

function applyFrame(data: Buffer): void {
  lastFrame = data;
  pendingFrame = null;
  lastRefreshUptimeS = uptimeS;
  cooldownRemainingS = COOLDOWN_S;
}

function tick(): void {
  uptimeS++;
  if (cooldownRemainingS > 0) {
    cooldownRemainingS--;
    if (cooldownRemainingS === 0 && pendingFrame !== null) {
      applyFrame(pendingFrame);
    }
  }
}

export function startTick(): void {
  if (tickHandle) return;
  tickHandle = setInterval(tick, TICK_INTERVAL_MS);
}

export function stopTick(): void {
  if (tickHandle) {
    clearInterval(tickHandle);
    tickHandle = null;
  }
}

export function resetState(): void {
  lastFrame = null;
  pendingFrame = null;
  uptimeS = 0;
  lastRefreshUptimeS = 0;
  cooldownRemainingS = 0;
}
