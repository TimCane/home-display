/**
 * GET /api/sse/system — SSE stream for system_state changes.
 * Admin session required.
 */

import { Hono } from "hono";
import { getSession } from "../auth/session.js";
import { onSystemEvent, type SystemEvent } from "../events.js";

export const sseSystemRoute = new Hono();

sseSystemRoute.get("/", async (c) => {
  const session = getSession(c);
  if (!session) {
    return c.text("Unauthorized", 401);
  }

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      const send = (event: SystemEvent) => {
        try {
          const data = JSON.stringify(event);
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        } catch {
          // Client disconnected
        }
      };

      // Send initial keepalive
      controller.enqueue(encoder.encode(": connected\n\n"));

      const unsubscribe = onSystemEvent(send);

      // Heartbeat every 30s to detect dead connections
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          clearInterval(heartbeat);
          unsubscribe();
        }
      }, 30_000);

      // Clean up on close
      c.req.raw.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
});
