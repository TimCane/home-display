import { Hono } from "hono";
import { getSetting } from "../config/settings.js";
import { FRAME_BYTES } from "../../shared/framebuffer.js";
import { getState, pushFrame, startTick } from "./state.js";
import { logger } from "../logger.js";

const mockDisplay = new Hono();

/**
 * Verify bearer token against the display_token setting.
 */
async function verifyToken(authHeader: string | undefined): Promise<boolean> {
  if (!authHeader) return false;
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const expected = await getSetting("display_token");
  return token === expected;
}

// GET /status — return current mock display state
mockDisplay.get("/status", async (c) => {
  if (!(await verifyToken(c.req.header("authorization")))) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  return c.json(getState());
});

// POST /fb — accept a framebuffer push
mockDisplay.post("/fb", async (c) => {
  if (!(await verifyToken(c.req.header("authorization")))) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const contentLength = Number(c.req.header("content-length") ?? 0);
  if (contentLength !== FRAME_BYTES) {
    return c.json(
      { error: `Expected Content-Length ${FRAME_BYTES}, got ${contentLength}` },
      400
    );
  }

  const body = await c.req.arrayBuffer();
  if (body.byteLength !== FRAME_BYTES) {
    return c.json(
      { error: `Expected body size ${FRAME_BYTES}, got ${body.byteLength}` },
      400
    );
  }

  const status = pushFrame(Buffer.from(body));
  return c.json({ status });
});

/**
 * Initialize the mock display (start background tick).
 */
export function initMockDisplay(): void {
  startTick();
  logger.info("Mock display server active");
}

export { mockDisplay };
