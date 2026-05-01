# Refresh contract

The panel takes ~25 s for a full refresh and the manufacturer warns against repeated rapid updates. The firmware enforces a 5-minute cooldown after every refresh.

## State machine

```
                  ┌─────────────────────────────┐
                  │                             │
                  ▼                             │
  ┌──────┐  POST /fb   ┌────────┐  refresh    ┌────────┐
  │ IDLE │ ──────────► │ ACTIVE │ ──────────► │COOLDOWN│
  └──────┘             └────────┘   ~25s      └────────┘
     ▲                     │                       │
     │                     │ POST /fb              │ POST /fb
     │                     ▼ (buffer, coalesce)    ▼ (buffer, coalesce)
     │                  pending=latest          pending=latest
     │                                              │
     └──────────────────── cooldown ends ───────────┘
                       (if pending: → ACTIVE)
                       (else:       → IDLE)
```

| State | Incoming `POST /fb` | Notes |
|---|---|---|
| `IDLE` | Stream body → buffer → start refresh → enter `ACTIVE` | The fast path. Response is `{"status":"accepted"}`. |
| `ACTIVE` | Receive into pending buffer; latest wins | Cannot start another refresh; panel is locked. Response is `{"status":"queued"}`. |
| `COOLDOWN` | Receive into pending buffer; latest wins | Cooldown is **5 minutes** (300 s) after refresh completion. Response is `{"status":"queued"}`. |

When the cooldown timer expires:

- If a pending frame is held → transition straight back to `ACTIVE` with that frame.
- Otherwise → return to `IDLE`.

## Coalescing

There is exactly one pending slot. A second push arriving while a frame is already pending overwrites it. **Only the most recent push wins.** This bounds RAM at one 163 KB buffer regardless of how aggressive the clients are.

## Concurrency

Buffer access is serialized by a FreeRTOS mutex. While the firmware is mid-stream to SPI (a brief ~150 ms window inside `ACTIVE`), a new upload that begins in that exact window is rejected with `503 Service Unavailable`. Pushes during the long ~25 s BUSY wait or during cooldown succeed normally and coalesce into the pending slot.

Concurrent uploads from multiple clients are not supported — the second upload sees `503` until the first completes.

## Watchdog

If the panel does not release BUSY within 60 s of a refresh starting, the firmware abandons the refresh, sleeps the panel, and forces the state machine into `COOLDOWN`. `GET /status` reports `last_refresh_timed_out: true` so monitoring can detect a hung panel (often a cable or DESPI-C02 issue).

## No partial refresh

4-color Spectra 3100 panels need full waveform cycles for the colored particles to migrate. Every refresh is full-screen — there is no API for sub-region updates and there will not be one.

## Boot

The panel is bistable: it retains the last image without power. The firmware does **not** clear or repaint on boot. Whatever was on the screen before reset stays. This avoids burning a 25 s refresh cycle (and its associated panel wear) every time the ESP32 reboots, OTAs, or hits a power blip.
