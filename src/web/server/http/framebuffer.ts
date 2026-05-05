/**
 * GET /api/framebuffer/:id — stream 163,200 bytes for an entry.
 * Admin session required. Supports ETag caching to avoid re-transferring
 * unchanged framebuffers.
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

  // Check ETag first — if the client already has this version we can skip
  // loading the 163 KB framebuffer blob entirely.
  const ifNoneMatch = c.req.header("If-None-Match");
  if (ifNoneMatch) {
    const [meta] = await db
      .select({ updatedAt: entries.updatedAt })
      .from(entries)
      .where(eq(entries.id, id))
      .limit(1);

    if (meta) {
      const etag = `"${id}-${meta.updatedAt.getTime()}"`;
      if (ifNoneMatch === etag) {
        return new Response(null, { status: 304, headers: { ETag: etag } });
      }
    }
  }

  // Full load — fetch framebuffer + updatedAt in one query
  const [entry] = await db
    .select({ framebuffer: entries.framebuffer, updatedAt: entries.updatedAt })
    .from(entries)
    .where(eq(entries.id, id))
    .limit(1);

  if (!entry) {
    return c.text("Not found", 404);
  }

  const etag = `"${id}-${entry.updatedAt.getTime()}"`;

  return new Response(new Uint8Array(entry.framebuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Length": String(entry.framebuffer.length),
      "Cache-Control": "private, max-age=3600, must-revalidate",
      ETag: etag,
    },
  });
});
