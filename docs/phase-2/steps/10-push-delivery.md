# Step 10 — Push delivery

## Goal

Implement the `pushFrame()` function per [push-delivery.md](../push-delivery.md): retry/backoff, in-flight serialization, confirmation polling, and `push_log` writes for every attempt.

## Depends on

Steps 5, 7, 9.

## Files

- `src/web/server/push/push-frame.ts` — main function
- `src/web/server/push/in-flight.ts` — single-slot mutex
- `src/web/server/push/confirm.ts` — `/status` polling helper
- `src/web/server/push/log.ts` — `push_log` insert helper
- `test/web/push.test.ts` — exercises against the mock display

## Tasks

1. `pushFrame({entryId, trigger})`:
   - If in-flight slot taken → log `dropped` and return `{ok: false, reason: 'in-flight'}`.
   - Acquire slot.
   - SELECT framebuffer bytes.
   - Read `display_base_url` + `display_token` from settings.
   - 3-attempt POST loop with 1s / 4s / 10s backoff:
     - On `200 {"status":"accepted"}` → break, go to confirm.
     - On `200 {"status":"queued"}` → log `succeeded=true, firmware_status='queued'`, return.
     - On `503` → continue (transient).
     - On other non-2xx → log error, return failure.
     - On network error → continue.
2. Confirmation poll for `accepted`:
   - `GET /status` every 5s up to 90s. Compare `last_refresh_uptime_s` to pre-push value.
   - If advanced → `succeeded=true`, write `panel_uptime_after`.
   - If 90s elapses → `succeeded=true`, `firmware_status='unconfirmed'`.
3. Always insert a `push_log` row with `{entry_id, attempted_at, succeeded, firmware_status, panel_uptime_after, error, trigger}`.
4. On overall success, caller is responsible for updating `currently_displayed_entry_id`, `last_shown_at`, `show_count` (scheduler does this in step 12).
5. Tests against the mock cover: accepted-then-confirmed, queued, retry-then-success, all-retries-fail, in-flight collision dropped.

## Acceptance

- `pushFrame` against the mock returns success and a `push_log` row appears.
- Two concurrent calls: one returns success, one is dropped + logged.
- A network failure (mock made to return 500) ends with a `push_log` failure row after ~15s.

## Notes

- Retry constants live in code, not `app_settings`. See [push-delivery.md § Retry policy](../push-delivery.md#retry-policy).
- `pushFrame` does not own scheduling decisions — it just delivers what it's told and logs.
