# new-home-display

A networked 4-color e-paper display. An ESP32 drives a 13.3" GDEY133F91 panel and exposes an HTTP push API. Clients render a framebuffer in 2-bit-per-pixel native format and POST it; the ESP32 streams it to the panel.

The client owns all rendering. The firmware owns the panel, the refresh contract, and rate limiting.

## Hardware

| Part | Role |
|---|---|
| [GDEY133F91](hardware/display/gdey133f91.md) | 13.3" 4-color (R/Y/B/W) e-paper, 960×680, SPI, SSD2677 driver IC |
| [ESP32-L](hardware/board/esp32-l-board.md) | ESP32-WROOM-32D dev board, WiFi, USB-C powered, always-on |
| [DESPI-C02](hardware/adapter/despi-c02.md) | 24-pin FPC ↔ ESP32-L adapter, plug-and-play |

The DESPI-C02 DIP switch must be set to the SSD-series RESE position (0.47 Ω) for the SSD2677.

## Design docs

### Phase 1 — firmware

- [Wire format](wire-format.md) — what bytes go on the wire
- [API](api.md) — endpoints, auth, status JSON
- [Refresh contract](refresh-contract.md) — state machine, cooldown, coalescing
- [Firmware](firmware.md) — build, flags, driver, memory, discovery
- [Out of scope](out-of-scope.md) — explicitly rejected options

### Phase 2 — web interface

- [Phase 2 overview](phase-2/README.md) — scheduler, editor, generators, guest links
