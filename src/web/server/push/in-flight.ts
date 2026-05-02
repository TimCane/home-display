/**
 * Single-slot mutex ensuring at most one push is in flight at any moment.
 */

let inFlight = false;

export function acquireSlot(): boolean {
  if (inFlight) return false;
  inFlight = true;
  return true;
}

export function releaseSlot(): void {
  inFlight = false;
}

/** Reset for testing. */
export function resetInFlight(): void {
  inFlight = false;
}
