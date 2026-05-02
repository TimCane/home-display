/**
 * POST /api/draft/:id/commit — raw-bytes framebuffer commit endpoint.
 *
 * Accepts the 163,200-byte framebuffer as the request body (application/octet-stream).
 * The entry title is passed via the X-Draft-Title header.
 * Auth is handled by the draft gate (UUID-as-bearer + optional admin session).
 */

import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { db } from "../db/index.js";
import { entries, entryDrafts } from "../db/schema.js";
import { getSession } from "../auth/session.js";
import { draftGate } from "../auth/draft-gate.js";
import { FRAME_BYTES } from "../../shared/framebuffer.js";

export const draftCommitRoute = new Hono();

draftCommitRoute.post("/:id/commit", async (c) => {
  const draftId = c.req.param("id");
  const session = getSession(c);

  // Run draft gate
  let draft;
  try {
    const result = await draftGate(draftId, session);
    draft = result.draft;
  } catch (err) {
    if (err instanceof TRPCError) {
      const statusMap: Record<string, number> = {
        NOT_FOUND: 404,
        UNAUTHORIZED: 401,
        BAD_REQUEST: 400,
      };
      return c.json(
        { error: err.message },
        (statusMap[err.code] ?? 500) as 400,
      );
    }
    throw err;
  }

  const title = c.req.header("x-draft-title");
  if (!title || title.trim().length === 0) {
    return c.json({ error: "X-Draft-Title header is required" }, 400);
  }

  const body = await c.req.arrayBuffer();
  const frame = Buffer.from(body);

  if (frame.length !== FRAME_BYTES) {
    return c.json(
      {
        error: `Frame must be exactly ${FRAME_BYTES} bytes, got ${frame.length}`,
      },
      400,
    );
  }

  // Atomic commit: re-check draft, create entry, consume draft
  try {
    const [entry] = await db.transaction(async (tx) => {
      const [fresh] = await tx
        .select({
          consumedAt: entryDrafts.consumedAt,
          expiresAt: entryDrafts.expiresAt,
        })
        .from(entryDrafts)
        .where(eq(entryDrafts.id, draft.id))
        .for("update");

      if (fresh.consumedAt) {
        throw new Error("Draft has already been used");
      }
      if (fresh.expiresAt < new Date()) {
        throw new Error("Draft has expired");
      }

      const created = await tx
        .insert(entries)
        .values({
          source: draft.guestMode ? "guest" : "admin",
          title: title.trim(),
          submitterName: draft.submitterName,
          framebuffer: frame,
          enabled: draft.enabled,
          baseWeight: draft.baseWeight,
          conditions: draft.conditions,
          showCount: 0,
        })
        .returning({ id: entries.id });

      await tx
        .update(entryDrafts)
        .set({ consumedAt: new Date() })
        .where(eq(entryDrafts.id, draft.id));

      return created;
    });

    return c.json({ entryId: entry.id });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to commit draft";
    return c.json({ error: message }, 400);
  }
});
