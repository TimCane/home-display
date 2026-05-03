import { useEffect, useRef, useCallback } from "react";
import { trpc } from "../trpc";

interface SystemEvent {
  type:
    | "displayed_entry"
    | "lock_change"
    | "flag_change"
    | "display_online"
    | "push_result";
  payload: Record<string, unknown>;
}

/**
 * Subscribe to SSE system events and keep the system.getState query fresh.
 * Returns the current system state from the tRPC query.
 */
export function useSystemState() {
  const utils = trpc.useUtils();
  const state = trpc.system.getState.useQuery(undefined, {
    refetchInterval: 60_000, // fallback poll
  });

  const reconnectTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const connect = useCallback(() => {
    const es = new EventSource("/api/sse/system");

    es.onmessage = (e) => {
      try {
        const event: SystemEvent = JSON.parse(e.data);
        // Invalidate system state on any relevant event
        if (
          event.type === "displayed_entry" ||
          event.type === "lock_change" ||
          event.type === "flag_change" ||
          event.type === "display_online"
        ) {
          utils.system.getState.invalidate(undefined);
        }
        if (event.type === "push_result") {
          utils.diagnostics.recentPushes.invalidate();
        }
      } catch {
        // ignore malformed events
      }
    };

    es.onerror = () => {
      es.close();
      // Reconnect with backoff
      reconnectTimeout.current = setTimeout(connect, 5_000);
    };

    return es;
  }, [utils]);

  useEffect(() => {
    const es = connect();
    return () => {
      es.close();
      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
    };
  }, [connect]);

  return state;
}
