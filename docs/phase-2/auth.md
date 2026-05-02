# Auth

Single domain, three actor classes:

| Actor | Authenticates with | Scope |
|---|---|---|
| Admin | GitHub OAuth, allowlisted login | Everything; required for non-guest `/editor/<uuid>` |
| Guest | Possession of link UUID | One-time edit + submit via `/editor/<uuid>` (guest-mode drafts only) |
| Backend → firmware | `display_token` bearer (matches firmware compile-time `EPD_TOKEN`) | `POST /fb`, `GET /status` on display |

## Admin auth — GitHub OAuth

OAuth 2.0 against GitHub's authorization server. Flow:

1. Unauthenticated request to a route requiring admin session → redirect to `/api/auth/login`. (Guest-mode `/editor/<uuid>` is exempt; non-guest `/editor/<uuid>` is gated per-draft inside the page.)
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

## Editor auth — UUID as bearer + optional admin gate

The link UUID in the URL path *is* the credential. The auth requirement depends on the draft's `guest_mode`:

| Draft type | Load `/editor/<uuid>` | Commit |
|---|---|---|
| `guest_mode = true` | UUID-as-bearer; admin session ignored | UUID-as-bearer |
| `guest_mode = false` | UUID-as-bearer **+** admin session required | UUID-as-bearer + admin session required |

Each request:

1. Route matches `/editor/<uuid>`.
2. Backend looks up `entry_drafts` by id.
3. If row missing, consumed, or expired → render "link no longer valid."
4. If `guest_mode = false` and no valid admin session → 401, redirect to `/api/auth/login`.
5. Otherwise render the editor.
6. Submission endpoint atomically marks `consumed_at = now()` and creates the `entries` row. Same gate logic as load-time (UUID + admin session for non-guest drafts).

Admin-only operations (`POST draft.create`, draft list, revoke) require admin session.

Trust model details in [entry-drafts.md](entry-drafts.md).

## Routing matrix

| Path | Behaviour |
|---|---|
| `/editor/<uuid>`, guest-mode draft | UUID-as-bearer. Admin session ignored. UUID validated server-side. |
| `/editor/<uuid>`, non-guest draft | UUID-as-bearer + admin session required. 401 → login redirect. |
| `/api/auth/*` | OAuth endpoints. No auth required to start the flow. |
| `/api/trpc/*` | Requires admin session cookie. 401 otherwise. |
| `/api/health` | Public, returns `{ok: true}` for Coolify health checks. |
| `/*` | Static React assets + admin SPA. Middleware checks for session. If absent → 302 to `/api/auth/login`. Special case: `/editor/*` paths bypass this middleware (auth handled per-draft inside the page). |

## Admin viewing a guest URL

Visiting `/editor/<uuid>` for a guest-mode draft with an active admin session shows the editor as a guest would see it (with `allowed_elements` filtering applied). The URL wins over identity for guest-mode drafts. Useful for testing what guests see without logging out.

For non-guest drafts, the admin session is the gate — admins always pass it; non-admins always bounce to login.

## CSRF

tRPC endpoints accept POSTs with the session cookie. The `SameSite=Lax` cookie attribute defends against most cross-site POSTs. Origin check on tRPC mutations as belt-and-braces.

## Display token

Stored in `app_settings.display_token`. Loaded by the backend on each push. The firmware's `EPD_TOKEN` is compile-time; rotating the DB value requires a corresponding firmware reflash. Mismatched tokens manifest as `401 Unauthorized` in `push_log`.
