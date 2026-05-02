# Config

Two storage layers:

1. **Env vars** — values needed before the DB connection is open, or required to authenticate the user who would *change* DB settings. Bootstrap-only.
2. **`app_settings` table** — generic key-value (`key text PK`, `value jsonb`) for everything editable at runtime via the admin UI. Adding a new setting requires no migration.

App-side Zod schemas validate `value` on read and write. Defaults applied if a key is missing.

## Env (must be env)

| Var | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `GITHUB_OAUTH_CLIENT_ID` | OAuth client ID |
| `GITHUB_OAUTH_CLIENT_SECRET` | OAuth client secret |
| `SESSION_SECRET` | HMAC key for session cookies |
| `ADMIN_GITHUB_LOGINS` | Comma-separated allowlist of GitHub usernames |
| `APP_BASE_URL` | Public URL of this app (for OAuth callback URL construction) |

## DB (`app_settings` keys)

| Key | Shape | Default | Notes |
|---|---|---|---|
| `palette` | `{black, white, yellow, red}` (RGB hex strings) | Vendor sample values | See [editor.md](editor.md) for calibration flow |
| `scheduler_cron` | string (cron expression) | `*/30 * * * *` | Reload affects next tick |
| `app_tz` | string (IANA timezone) | `Europe/London` | Used by condition evaluators and generators |
| `health_check_minutes` | int | `5` | Cadence of `/status` polling |
| `display_base_url` | string | (set per deploy) | Points at firmware via Cloudflare tunnel, or at the dev mock server |
| `display_token` | string | (set per deploy) | Bearer for firmware. Must match firmware compile-time `EPD_TOKEN`. |
| `flags` | `{<flag_name>: bool}` | `{}` | Stored on `system_state.flags`, not `app_settings`. Listed here for reference. |

Per-instance generator config lives in `generator_instances.config`, not `app_settings`.

## UI surfaces

The admin "Settings" page exposes one form per `app_settings` key (or grouped reasonably — palette together, display together, scheduling together).

`flags` are exposed on the dashboard as toggles, since they're toggled frequently.

## On-startup behaviour

On boot, the backend:

1. Reads required env vars. If any missing, fail fast with a clear error.
2. Connects to DB.
3. Runs Drizzle migrations.
4. Reads each `app_settings` key. If missing, inserts the default.
5. Validates all values against Zod schemas. Fail fast on schema mismatch (almost always means a recent code change changed a setting's shape; manual fix-up needed).
6. Starts node-cron with the current `scheduler_cron`.
7. Registers each `generator_instances` cron.
8. Starts the HTTP server.

## Reloading

Editing an `app_settings` value via the admin UI:
- Persists to DB immediately.
- App-layer cached values are invalidated.
- For `scheduler_cron`: re-register the job with node-cron.
- For `health_check_minutes`: same.
- For `display_base_url` / `display_token`: next push reads the new value.
- For `palette`: next backend re-render uses the new values; browser preview picks them up on next page load.
- For `app_tz`: next condition eval / generator run uses the new TZ.
