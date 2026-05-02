# Step 11 — Health checks

## Goal

Independent node-cron job polling the firmware `/status` at `app_settings.health_check_minutes`, writing `display_status_history`, and updating `system_state.display_online{,_since}`.

## Depends on

Steps 5, 7, 9.

## Files

- `src/web/server/health/poll.ts` — single-shot poll
- `src/web/server/health/cron.ts` — node-cron registration; re-register on settings change
- `src/web/server/boot.ts` — start health cron after settings load

## Tasks

1. Install `node-cron`.
2. `poll()` does:
   - GET `<display_base_url>/status` with bearer.
   - Insert `display_status_history` row `{polled_at, reachable, status?}`.
   - Compare to current `system_state.display_online`. On transition, update `display_online` and stamp `display_online_since`.
   - Emit a change event (for the SSE stream in step 13).
3. `cron.ts`:
   - Register a job at `*/<health_check_minutes> * * * *` (or build the cron expr).
   - Subscribe to `health_check_minutes` setting changes; unregister + re-register on change.
4. `boot.ts` calls `startHealthCron()` after settings are loaded.

## Acceptance

- Boot with mock display reachable → `display_status_history` rows accumulate at the configured cadence.
- Stop the mock → next poll writes `reachable=false` and `system_state.display_online` flips, `display_online_since` updates.
- Edit `health_check_minutes` (direct DB poke or future tRPC call) → cron re-registers.

## Notes

- This is independent of `pushFrame`. They both read from `app_settings` but neither blocks the other.
- Forever retention; pruning is a future concern (see [ops.md § Observability gaps](../ops.md#observability-gaps-v1-accepts)).
