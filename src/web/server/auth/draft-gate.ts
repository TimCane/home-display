/**
 * Draft gate — per-draft auth check.
 *
 * Resolves the draft by UUID. Returns 404/410 if missing/consumed/expired.
 * If the draft is non-guest and the request has no admin session, returns 401.
 */

import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { db } from "../db/index.js";
import { entryDrafts } from "../db/schema.js";
import type { SessionPayload } from "./session.js";

export interface DraftGateResult {
  draft: typeof entryDrafts.$inferSelect;
}

/**
 * Validate that a draft exists, is not consumed/expired, and that the caller
 * has permission to access it.
 *
 * - Guest drafts: accessible by anyone with the UUID.
 * - Non-guest drafts: additionally require a valid admin session.
 */
export async function draftGate(
  draftId: string,
  session: SessionPayload | null,
): Promise<DraftGateResult> {
  const [draft] = await db
    .select()
    .from(entryDrafts)
    .where(eq(entryDrafts.id, draftId))
    .limit(1);

  if (!draft) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Draft not found" });
  }

  if (draft.consumedAt) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Draft has already been used",
    });
  }

  if (draft.expiresAt < new Date()) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Draft has expired",
    });
  }

  if (!draft.guestMode && !session) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Admin session required for non-guest drafts",
    });
  }

  return { draft };
}
