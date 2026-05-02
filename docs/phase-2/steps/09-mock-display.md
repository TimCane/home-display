# Step 9 — Mock display server

## Goal

A dev-only, in-process mock of the firmware's `/fb` and `/status` endpoints so push delivery and the scheduler can be exercised locally without a real panel. Default dev seed of `display_base_url` points at it.

## Depends on

Steps 7, 8.

## Files

- `src/web/server/mock-display/index.ts` — Hono sub-app
- `src/web/server/mock-display/state.ts` — in-memory cooldown + last-frame state
- `src/web/server/index.ts` — mount mock at e.g. `/mock-display/*` only when `NODE_ENV !== 'production'`
- A dev-bootstrap script or seed SQL setting `display_base_url` to the mock URL on first run

## Tasks

1. Mock state holds `{lastRefreshUptimeS, busy, cooldownRemainingS, uptimeS, freeHeap, rssi, pendingFrame}` mirroring [../../api.md](../../api.md).
2. `POST /mock-display/fb`:
   - Bearer-check against `app_settings.display_token`.
   - Reject if `Content-Length != 163200`.
   - If cooldown active → store as `pendingFrame`, return `200 {"status":"queued"}`.
   - Else → "refresh," advance `lastRefreshUptimeS`, set 5-min cooldown timer, return `200 {"status":"accepted"}`.
3. `GET /mock-display/status`:
   - Bearer-check.
   - Return current state JSON.
4. Background tick decrements `cooldownRemainingS` and, when it hits 0 with a pending frame, applies the pending frame.
5. Add a dev-only one-shot that, on first boot when `display_base_url` is unset, sets it to `http://localhost:<port>/mock-display`.

## Acceptance

- `pnpm dev` → `curl -H 'Authorization: Bearer <token>' localhost:<port>/mock-display/status` returns plausible JSON.
- POSTing a 163,200-byte body returns `accepted` then `queued` if hammered within 5 min.
- Wrong-size or wrong-token POSTs are rejected.

## Notes

- Production builds should not mount the mock. Guard with `NODE_ENV` or an `ENABLE_MOCK_DISPLAY` flag.
- The mock is a pure dev convenience — it never appears in `docker-compose.yml`.
