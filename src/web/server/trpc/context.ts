import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import { verifySessionToken, type SessionPayload } from "../auth/session.js";
import { getCookie } from "../auth/cookies.js";
import { db } from "../db/index.js";

export interface TRPCContext {
  session: SessionPayload | null;
  db: typeof db;
}

/**
 * Creates the tRPC context from the incoming fetch request.
 * Parses the session cookie and provides the DB instance.
 */
export function createContext(opts: FetchCreateContextFnOptions): TRPCContext {
  const req = { header: (name: string) => opts.req.headers.get(name) ?? undefined };
  const token = getCookie(req, "session");
  const session = token ? verifySessionToken(token) : null;

  return { session, db };
}
