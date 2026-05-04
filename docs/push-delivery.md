# Push delivery

How a chosen entry's framebuffer gets from the backend to the firmware. The firmware's contract is in [api.md](api.md) and [refresh-contract.md](refresh-contract.md) — this doc covers the backend-side behaviour.

## Push triggers

Canonical list of every event the backend considers, and whether it pushes.

| Event | Pushes? | Notes |
|---|---|---|
| Scheduler tick (winner picked) | Yes | Winner differs from currently displayed by construction (same-entry-no-repeat) |
| Lock change | Yes | Push the new lock target |
| "Display now" button | Yes | Per-entry one-shot; bypasses scheduling rules |
| Entry created | No | Waits for next tick |
| Entry framebuffer updated (e.g. generator regen) | No | Waits for next tick |
| Health check sees panel offline → online | No | Waits for next tick |

Rationale for the "No" rows: the firmware has a 5-min cooldown and bistable pixels — extra pushes waste refreshes and shorten panel life. Let the next tick decide.

## Push attempt

For each push, the backend:

1. Reads the entry's framebuffer (163,200 bytes).
2. POSTs to `<display_base_url>/fb` with `Authorization: Bearer <display_token>`, `Content-Type: application/octet-stream`, `Content-Length: 163200`.
3. Retries on failure (see below).
4. On firmware response:
   - `200 {"status":"accepted"}` → poll `/status` to confirm refresh.
   - `200 {"status":"queued"}` → mark success, do not poll. The firmware will refresh after cooldown.
   - `503` → treat as transient, retry.
   - other 4xx/5xx → log error, fail this trigger, surface in admin UI.
5. Inserts a `push_log` row regardless of outcome.

## Retry policy

Within a single push attempt: 3 tries with 1s / 4s / 10s backoff. Worst-case time-to-fail per push: ~15s.

If all 3 attempts fail (network error, 503, etc.):
- The push is logged as failed.
- No further retries within this trigger. The next scheduler tick (or next health-check + push opportunity) will try again.
- The entry's `last_shown_at` is *not* updated.

Push retry policy values are not exposed in admin UI. They live as constants in code.

## Confirmation poll

After a successful POST with `accepted`, the backend polls `GET /status` every 5 seconds for up to 90 seconds, watching `last_refresh_uptime_s`. If it advances above the value seen pre-push: confirmed. The `panel_uptime_after` is recorded in `push_log`.

If 90s elapses without `last_refresh_uptime_s` advancing: mark `succeeded=true` but `firmware_status='unconfirmed'`. The firmware accepted the frame; it just didn't finish refreshing in time (likely queued behind cooldown).

For `queued` responses: skip polling. The firmware can hold the frame for up to ~5 min (cooldown). Polling that long would block the request unnecessarily.

## Concurrency: in-flight push collision

If a new push trigger arrives while a push is already in flight:
- The push function refuses the new request and logs it as dropped.
- The scheduler's "winner pick" is discarded — next tick will pick again.
- The firmware's coalescing means the in-flight push will deliver the right thing or be superseded by a later push naturally.

This guarantees at most one outbound POST to `/fb` is in flight at any moment.

## Health checks

Independent of pushes. A node-cron job runs every `app_settings.health_check_minutes` (default 5) and:

1. GETs `/status`.
2. Inserts a row in `display_status_history` with the result.
3. Updates `system_state.display_online` and `display_online_since`.

The admin UI subscribes to these via SSE and updates an "online / offline" indicator in real time.

## Offline behaviour

When the panel is offline:
- Push attempts fail per the retry policy and log as such.
- Health checks fail and update `system_state.display_online = false`.
- Scheduler ticks continue — they pick a winner, attempt a push, and fail. The repeated failures show up in `push_log` and in the dashboard offline indicator.
- When the panel returns: the next scheduler tick (or next manual trigger) succeeds normally. There is no replay of missed pushes.

## Surfaced in admin UI

These signals (online/offline, last push, push history, hardware concern flag, WiFi/heap/uptime, test-pattern button) are surfaced on the diagnostics page — see [ops.md](ops.md#diagnostics-page).
