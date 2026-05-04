/**
 * Tiny in-process pub/sub for system_state changes.
 * Subscribers (SSE connections) receive events when lock, displayed entry,
 * flags, or display-online status change.
 */

export interface SystemEvent {
  type:
    | "displayed_entry"
    | "lock_change"
    | "flag_change"
    | "display_online"
    | "push_result";
  payload: Record<string, unknown>;
}

type SystemEventListener = (event: SystemEvent) => void;

const listeners = new Set<SystemEventListener>();

export function onSystemEvent(fn: SystemEventListener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function emitSystemEvent(event: SystemEvent): void {
  for (const fn of listeners) {
    fn(event);
  }
}
