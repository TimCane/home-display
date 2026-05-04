# 001 — Docker prod migrations broken

**Type:** Bug
**Severity:** High

## Problem

`docker-entrypoint.sh` runs `pnpm drizzle-kit migrate` on container start. However, `drizzle-kit` is listed as a `devDependency` in `package.json`. The runtime stage of the Dockerfile installs with `--prod`, so `drizzle-kit` is not available and migrations fail on deploy.

## Where

- `docker-entrypoint.sh:4`
- `package.json` — `drizzle-kit` under `devDependencies`
- `Dockerfile:20` — `pnpm install --frozen-lockfile --prod`

## Fix options

1. **Move `drizzle-kit` to `dependencies`** — simplest, adds ~2 MB to the prod image. Migrations just work.
2. **Run migrations in the build stage** — requires a DB connection at build time (not practical with Docker Compose).
3. **Use Drizzle's programmatic migrate API** — call `drizzle-kit/migrate` from Node at boot instead of the CLI. Avoids needing the full `drizzle-kit` package at runtime. Drizzle ORM's `migrate()` function only needs the migration files and the ORM itself (both already in prod).
