# Step 5 — Drizzle schema + initial migration

## Goal

Define every table from [data-model.md](../data-model.md) in Drizzle, generate the initial migration, and wire it into the container entrypoint.

## Depends on

Step 4.

## Files

- `drizzle.config.ts`
- `src/web/server/db/index.ts` — pool + `db` client
- `src/web/server/db/schema/` — one file per table or one shared `schema.ts`
- `src/web/server/db/migrations/0000_init.sql` (generated)

## Tasks

1. Install `drizzle-orm`, `drizzle-kit`, `pg`, `@types/pg`.
2. Define schema:
   - `entries` (with `framebuffer bytea`, CHECK `octet_length(framebuffer) = 163200`)
   - `entry_drafts`
   - `generator_instances` (FK → `entries.id`, cascade delete)
   - `system_state` (singleton, seed `id = 1`)
   - `app_settings`
   - `push_log` (FK → `entries.id` `ON DELETE SET NULL`)
   - `display_status_history`
   - `generator_runs` (FK → `generator_instances.id`)
3. `drizzle-kit generate` → review the SQL → commit `0000_init.sql`.
4. Update entrypoint to run `drizzle-kit migrate` against `DATABASE_URL`.
5. On first boot the app should also INSERT the singleton `system_state` row if missing (idempotent).

## Acceptance

- `docker compose up --build` from a fresh volume runs the migration successfully and starts the app.
- `psql` into `db` shows all 8 tables and the `system_state` singleton.
- CHECK constraint rejects an INSERT with a wrong-sized framebuffer (manual `psql` smoke check).

## Notes

- `app_settings` defaults are seeded by application code on boot (step 7), not by migration.
- All timestamps `timestamptz`. See [data-model.md § Conventions](../data-model.md#conventions).
