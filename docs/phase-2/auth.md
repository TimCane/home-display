# Auth

Single domain, three actor classes:

| Actor | Authenticates with | Scope |
|---|---|---|
| Admin | GitHub OAuth, allowlisted login | Everything except `/g/<uuid>` |
| Guest | Possession of link UUID | One-time submission via `/g/<uuid>` |
| Backend → firmware | `display_token` bearer (matches firmware compile-time `EPD_TOKEN`) | `POST /fb`, `GET /status` on display |

## Admin auth — GitHub OAuth

OAuth 2.0 against GitHub's authorization server. Flow:

1. Unauthenticated request to a non-`/g/*` route → redirect to `/api/auth/login`.
2. `/api/auth/login` → 302 to GitHub authorize URL.
3. GitHub callback → `/api/auth/callback` → fetch user info from GitHub.
4. Verify `user.login` is in `ADMIN_GITHUB_LOGINS` (env var, comma-separated). If not, return 403.
5. Set a `SameSite=Lax` session cookie. Redirect to original URL.

### Why allowlist by GitHub login (not org membership)

Single-user app; explicit list is simpler than checking org membership and surviving an org rename / private-membership flip. The list holds 1 today, can hold N later via env edit.

### Required env

| Var | Purpose |
|---|---|
| `GITHUB_OAUTH_CLIENT_ID` | OAuth app client ID |
| `GITHUB_OAUTH_CLIENT_SECRET` | OAuth app client secret |
| `ADMIN_GITHUB_LOGINS` | Comma-separated GitHub usernames |
| `SESSION_SECRET` | HMAC key for session cookies |

These cannot move to DB (chicken-egg: needed during the request that authenticates the user who would manage DB settings).

## Guest auth — link UUID as bearer

The link UUID in the URL path *is* the credential. No password. No session. Each request:

1. Route matches `/g/<uuid>`.
2. Backend looks up `guest_links` by id.
3. If row exists, not consumed, not expired → render guest UI.
4. Submission endpoint re-validates the UUID at submission time and atomically marks `consumed_at = now()`.

Trust model details in [guest-links.md](guest-links.md).

## Routing matrix

| Path | Behaviour |
|---|---|
| `/g/<uuid>` | Guest UI. No admin auth required. UUID validated server-side. |
| `/api/auth/*` | OAuth endpoints. No auth required to start the flow. |
| `/api/trpc/*` | Requires admin session cookie. 401 otherwise. |
| `/api/health` | Public, returns `{ok: true}` for Coolify health checks. |
| `/*` | Static React assets + admin SPA. Middleware checks for session. If absent → 302 to `/api/auth/login`. Special case: `/g/*` paths bypass this middleware. |

## Admin viewing guest URL

Visiting `/g/<uuid>` with an active admin session shows the guest UI as-is. The URL wins over identity. This is intentional — useful for testing what guests see without logging out.

## CSRF

tRPC endpoints accept POSTs with the session cookie. The `SameSite=Lax` cookie attribute defends against most cross-site POSTs. Origin check on tRPC mutations as belt-and-braces.

## Display token

Stored in `app_settings.display_token`. Loaded by the backend on each push. The firmware's `EPD_TOKEN` is compile-time; rotating the DB value requires a corresponding firmware reflash. Mismatched tokens manifest as `401 Unauthorized` in `push_log`.
