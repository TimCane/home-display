import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import { verifySessionToken, type SessionPayload } from "../auth/session.js";
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
  const cookieHeader = opts.req.headers.get("cookie");
  let session: SessionPayload | null = null;

  if (cookieHeader) {
    for (const part of cookieHeader.split(";")) {
      const [k, ...v] = part.trim().split("=");
      if (k === "session") {
        session = verifySessionToken(v.join("="));
        break;
      }
    }
  }

  return { session, db };
}
