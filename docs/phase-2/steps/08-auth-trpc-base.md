# Step 8 — Auth + tRPC base

## Goal

GitHub OAuth, signed session cookies, admin allowlist enforcement, and a tRPC mount with context + an `adminProcedure` helper. Routing matrix from [auth.md](../auth.md) becomes real.

## Depends on

Steps 7, 3.

## Files

- `src/web/server/auth/oauth.ts` — GitHub OAuth dance
- `src/web/server/auth/session.ts` — sign/verify session cookies (HMAC, `SESSION_SECRET`)
- `src/web/server/auth/middleware.ts` — `requireAdmin` Hono middleware; SPA bounce middleware on `/*`
- `src/web/server/trpc/context.ts` — builds `{session, db}` per request
- `src/web/server/trpc/trpc.ts` — `t = initTRPC.context...`, `router`, `publicProcedure`, `adminProcedure`
- `src/web/server/trpc/index.ts` — root `appRouter` (empty for now)
- `src/web/server/index.ts` — mount `/api/auth/*`, `/api/trpc/*`, `/*` middleware

## Tasks

1. Install `@trpc/server`, `@trpc/client`, `cookie`, `@octokit/oauth-app` or hand-roll OAuth with `fetch`.
2. OAuth flow per [auth.md § Admin auth](../auth.md#admin-auth--github-oauth):
   - `GET /api/auth/login` → 302 to GitHub authorize URL with state.
   - `GET /api/auth/callback` → exchange code, fetch `GET /user`, check `login` ∈ `ADMIN_GITHUB_LOGINS`. 403 if not.
   - On success: set `SameSite=Lax`, `HttpOnly`, `Secure` (in prod) signed cookie. Redirect to original URL (carried in `state` or a return-to cookie).
   - `POST /api/auth/logout` → clear cookie.
3. `session.ts`: HMAC-SHA256 signed payload `{login, iat}`. Verify on every request.
4. SPA bounce middleware: any `/*` request without a valid session that isn't `/api/*` or `/editor/*` → 302 to `/api/auth/login`. `/api/health` exempt.
5. tRPC:
   - `context()` builds `{session, db}` from the Hono request.
   - `adminProcedure` throws `UNAUTHORIZED` if no session; everything tRPC defaults to it unless overridden.
   - Mount `appRouter` (empty) at `/api/trpc`.
6. CSRF: `SameSite=Lax` + an Origin check on tRPC mutations.

## Acceptance

- Visiting `/` while logged-out bounces to GitHub.
- Logging in as an allow-listed user lands back on `/`.
- Logging in as a non-allow-listed user returns 403.
- `curl /api/trpc/<anything>` without a session returns 401.
- `/api/health` is reachable without a session.
- `/editor/<uuid>` is *not* bounced by middleware (the per-draft gate lands in step 14).

## Notes

- Admin login UI itself (a "Log in with GitHub" button at `/login` if you want one) can land in step 17 with the React shell. The bounce-to-OAuth flow is enough for now.
- See [auth.md § Routing matrix](../auth.md#routing-matrix) — this step implements every row except the per-draft `/editor/<uuid>` gate.
