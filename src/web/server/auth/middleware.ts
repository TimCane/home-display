import type { Context, Next } from "hono";
import { getSession } from "./session.js";

/**
 * SPA bounce middleware: redirects unauthenticated requests to GitHub OAuth login.
 *
 * Exempt paths:
 *   - /api/*        (API routes handle their own auth)
 *   - /editor/*     (per-draft gate in step 14)
 *   - Static assets (files with extensions like .js, .css, .png, etc.)
 */
export async function spaBounce(c: Context, next: Next) {
  const path = c.req.path;

  // Exempt paths
  if (
    path.startsWith("/api/") ||
    path.startsWith("/editor/") ||
    hasFileExtension(path)
  ) {
    return next();
  }

  const session = getSession(c);
  if (!session) {
    const returnTo = encodeURIComponent(path);
    return c.redirect(`/api/auth/login?return_to=${returnTo}`);
  }

  return next();
}

/**
 * Hono middleware that requires a valid admin session.
 * Returns 401 JSON if no session is present.
 */
export async function requireAdmin(c: Context, next: Next) {
  const session = getSession(c);
  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  return next();
}

/** Check if a path looks like a static asset (has a file extension). */
function hasFileExtension(path: string): boolean {
  const lastSegment = path.split("/").pop() || "";
  return lastSegment.includes(".") && !lastSegment.startsWith(".");
}
