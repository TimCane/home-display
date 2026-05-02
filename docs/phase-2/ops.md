# Ops

## Deploy

- Coolify on Hetzner reads `docker-compose.yml` from the repo.
- Two services: `app` (Node) and `db` (Postgres).
- GitHub webhook on push to `main` triggers Coolify to rebuild and restart the stack.

## Migrations

- Drizzle Kit generates migration files, checked into the repo under `src/web/server/db/migrations/`.
- The `app` container's entrypoint runs `drizzle-kit migrate` before starting the Node process. No manual step.
- Schema changes flow through PR → review → merge → auto-migrate on deploy.

## Backups

- Coolify is configured to back up the Postgres volume to Hetzner Object Storage on a nightly schedule.
- Backup contents include `entries.framebuffer` (159 KiB each) — most of the size will be framebuffers and `push_log` rows.

Restore is a Coolify operation; not yet rehearsed. (TODO before going to long-term prod.)

## Logging

- pino → stdout. Coolify captures container logs.
- Structured JSON: each entry has at minimum `{level, time, msg}` plus event-specific fields.
- Notable events to log explicitly:
  - Scheduler tick (chosen entry, candidate count, scoring)
  - Push attempt (entry id, trigger, retry attempt, response, duration)
  - Generator run (instance id, success/error, duration)
  - Health check (reachable, online transition)
  - Auth (login success, login refused with reason)

## Local development

- `pnpm dev` runs the Node backend + Vite dev server. Vite proxies `/api/*` to the backend.
- Backend reads its config from a local Postgres (docker-compose) and uses whatever `display_base_url` is in that DB.
- Default dev DB seed points at the in-process **mock display** (`src/web/server/mock-display/`) — accepts POSTs, returns plausible `/status` JSON, simulates cooldown.
- To dev against the real panel: update `display_base_url` in the dev DB to the Cloudflare tunnel URL. Be aware: real pushes hit the firmware's 5-min cooldown, so iteration is throttled.

## Tests

V1 scope is intentionally narrow — only the byte-correct stuff:

- **Vitest** unit tests for `src/web/shared/dither.ts` and `src/web/shared/framebuffer.ts`.
- Test cases cover: known input → known output (golden frames), edge palettes, off-by-one in row strides, etc.

Skipped V1: integration tests, e2e, Playwright. Add when something specific burns.

## CI/CD

GitHub Actions on PR:

- `pnpm install`
- `pnpm typecheck` (tsc --noEmit across both server and client)
- `pnpm test` (Vitest)

Merge to `main`:
- Coolify webhook fires.
- Coolify rebuilds the Docker image and restarts the stack.
- Migrations run automatically on container start.

## Diagnostics page

Single admin route showing everything operational:

- Latest `/status` fields (busy, cooldown_remaining_s, last_refresh_uptime_s, last_refresh_timed_out, uptime_s, free_heap, rssi, pending_frame)
- Health check freshness (last successful poll + age)
- Last N rows of `push_log`
- Per-generator-instance last success / last error from `generator_runs`
- Manual flag toggles (writes to `system_state.flags`)
- "Push test pattern" button (sends a 4-quadrant solid-color frame)

## Observability gaps (V1 accepts)

- No external log aggregation (Loki / Better Stack / Axiom). Coolify container logs only.
- No metrics (Prometheus). Push log + status history are the only structured time-series.
- No alerting on offline / failed pushes. Watch the dashboard.

These are intentional V1 constraints. Revisit when the manual checking feels burdensome.
