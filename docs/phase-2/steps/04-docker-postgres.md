# Step 4 — Docker + Postgres

## Goal

Containerize the Node app and provision a sibling Postgres for local dev and Coolify deploy. Container entrypoint will run migrations before starting Node (migrations themselves arrive in step 5).

## Depends on

Step 3.

## Files

- `Dockerfile` — multi-stage: deps → build (Vite) → runtime (Node)
- `docker-compose.yml` — `app` + `db` services, named volume for Postgres data
- `.dockerignore`
- `docker-entrypoint.sh` (or inline in Dockerfile `CMD`) — runs migrations then `node`
- `.env.example` — documents required env vars

## Tasks

1. Multi-stage Dockerfile:
   - `deps` stage: `pnpm install --frozen-lockfile`.
   - `build` stage: `pnpm build` (Vite + server transpile).
   - `runtime` stage: copy `node_modules`, built server, built client; `EXPOSE` the HTTP port.
2. `docker-compose.yml`:
   - `app`: builds from Dockerfile, depends_on `db`, reads `.env`, mounts nothing (immutable image).
   - `db`: official `postgres:16` image, named volume, healthcheck.
3. Entrypoint script: `pnpm drizzle-kit migrate` (no-op for now, since no migrations exist yet) then `node dist/server/index.js`.
4. `.env.example` lists `DATABASE_URL`, `SESSION_SECRET`, `GITHUB_OAUTH_*`, `ADMIN_GITHUB_LOGINS`, `APP_BASE_URL`.

## Acceptance

- `docker compose up --build` brings up both services; `curl localhost:<port>/api/health` returns `{ok: true}`.
- `docker compose down -v` cleans the volume.
- Image builds without dev deps in the final stage.

## Notes

- See [ops.md § Deploy](../ops.md#deploy) and [config.md § Env](../config.md#env-must-be-env).
- Coolify reads this same `docker-compose.yml`.
