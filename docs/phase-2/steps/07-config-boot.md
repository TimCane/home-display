# Step 7 — Config layer + boot sequence

## Goal

Implement the env-vs-DB config split from [config.md](../config.md), with a Zod-validated `app_settings` reader/writer, defaults seeded on boot, and the full startup sequence.

## Depends on

Steps 5, 6.

## Files

- `src/web/server/config/env.ts` — required env vars, fail-fast validation
- `src/web/server/config/settings.ts` — `getSetting(key)`, `setSetting(key, value)`, in-memory cache + invalidation
- `src/web/server/config/schema.ts` — Zod schema per `app_settings` key + defaults table
- `src/web/server/boot.ts` — orchestrates the startup sequence
- `src/web/server/index.ts` — calls `boot()` then starts HTTP server

## Tasks

1. `env.ts`: parse `process.env` against a Zod schema for every var in [config.md § Env](../config.md#env-must-be-env). Throw a single human-readable error listing all missing keys.
2. `schema.ts`: one entry per `app_settings` key (`palette`, `scheduler_cron`, `app_tz`, `health_check_minutes`, `first_view_boost`, `decay_half_life_hours`, `display_base_url`, `display_token`) with shape + default.
3. `settings.ts`:
   - On read miss in cache → SELECT, validate, cache, return.
   - On read of missing row → INSERT default, cache, return.
   - On write → UPDATE/UPSERT, validate, invalidate cache entry, fire change event.
4. `boot.ts` runs:
   1. Parse env (fail-fast).
   2. Connect to DB.
   3. Run Drizzle migrations (idempotent; safe even if entrypoint already did).
   4. Seed every `app_settings` default if missing.
   5. Validate every `app_settings` value against schema; fail-fast on mismatch.
   6. (Cron scheduler + generator instances + HTTP server start in later steps; reserve hooks here.)
5. Subscribers can register on settings change (used later by scheduler + health-check cron to re-register on cron-string changes).

## Acceptance

- Booting with a missing required env var prints all missing keys and exits non-zero.
- Booting against an empty `app_settings` table populates every default and the row count matches the key list.
- Editing a setting in DB, then calling `getSetting`, returns the new value (cache invalidation works).

## Notes

- Setting writes via tRPC arrive in step 13, but the underlying API is here.
- `system_state.flags` is *not* in `app_settings`; it lives on the singleton row (see [config.md § Other runtime-mutable state](../config.md#other-runtime-mutable-state-not-in-app_settings)).
