/**
 * GET /api/framebuffer/:id — stream 163,200 bytes for an entry.
 * Admin session required.
 */

import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { entries } from "../db/schema.js";
import { getSession } from "../auth/session.js";

export const framebufferRoute = new Hono();

framebufferRoute.get("/:id", async (c) => {
  const session = getSession(c);
  if (!session) {
    return c.text("Unauthorized", 401);
  }

  const id = c.req.param("id");

  const [entry] = await db
    .select({ framebuffer: entries.framebuffer })
    .from(entries)
    .where(eq(entries.id, id))
    .limit(1);

  if (!entry) {
    return c.text("Not found", 404);
  }

  return new Response(new Uint8Array(entry.framebuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Length": String(entry.framebuffer.length),
    },
  });
});
