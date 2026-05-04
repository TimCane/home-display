# Deploy Runbook

Production deployment of the home-display web app via Coolify on Hetzner.

## Prerequisites

- Hetzner VPS with Coolify installed
- Domain pointing to the server (e.g. `display.<domain>`)
- GitHub OAuth app created at <https://github.com/settings/developers>
- Cloudflared tunnel configured (for ESP32 firmware connectivity)

## Coolify project setup

1. Create a new project in Coolify.
2. Add a **Docker Compose** resource pointing to this repository's `main` branch.
3. Under **Build & Deploy**, configure the GitHub webhook so pushes to `main` trigger automatic rebuild and restart.
4. Ensure the Coolify deployment uses `docker-compose.yml` from the repo root.

## Postgres volume + backups

1. Coolify manages the `pgdata` volume defined in `docker-compose.yml`. Verify the volume persists across deploys (it should by default).
2. Configure **nightly backups** to Hetzner Object Storage:
   - Set up a cron job on the host (or via Coolify scheduled task) that runs `pg_dump` against the container and uploads the dump to an S3-compatible Hetzner bucket.
   - Example: `docker exec <db-container> pg_dump -U display home_display | gzip | s3cmd put - s3://backups/home-display/$(date +%F).sql.gz`
3. **Backup restore drill** is a TODO before long-term production use.

## Environment variables

Provision the following env vars in Coolify (or via `.env` on the host):

| Variable                     | Description                                                |
| ---------------------------- | ---------------------------------------------------------- |
| `DATABASE_URL`               | Postgres connection string (matches compose `db`)          |
| `GITHUB_OAUTH_CLIENT_ID`     | GitHub OAuth app client ID                                 |
| `GITHUB_OAUTH_CLIENT_SECRET` | GitHub OAuth app client secret                             |
| `ADMIN_GITHUB_LOGINS`        | Comma-separated GitHub usernames allowed admin access      |
| `SESSION_SECRET`             | Random string for HMAC session cookies                     |
| `APP_BASE_URL`               | Public URL of the app (e.g. `https://display.<domain>`)    |

All variables are required. See `.env.example` for defaults and `src/web/server/config/env.ts` for validation.

## First deploy checklist

1. Push to `main` (or manually trigger in Coolify).
2. Watch logs to confirm:
   - `drizzle-kit migrate` ran successfully (tables created).
   - Server started on port 3100.
3. Navigate to the app URL and log in with a GitHub account listed in `ADMIN_GITHUB_LOGINS`.
4. Go to **Settings** and configure:
   - `display_base_url` -- the URL the app uses to reach the ESP32 firmware (via cloudflared tunnel).
   - `display_token` -- the bearer token the firmware expects.
5. Verify the **Diagnostics** page shows the display as online (health check should pass).
6. Confirm the **GitHub OAuth callback URL** is set to `<APP_BASE_URL>/api/auth/callback` in the GitHub OAuth app settings.

## Rotating `display_token`

Changing the display token requires updating both sides:

1. Update `display_token` in the app's **Settings** page.
2. Reflash the ESP32 firmware with the new token.

There is no graceful handoff -- the display will be unreachable between the token change and firmware reflash.

## Observability (V1 gaps)

The following are accepted gaps in V1 per `docs/phase-2/ops.md`:

- No external log aggregation (logs go to stdout only).
- No metrics or dashboards beyond the in-app Diagnostics page.
- No alerting.
- No automatic retention/GC on `push_log`, `display_status_history`, or `generator_runs` tables (will add nightly prune when queries slow).
