# home-display

A networked 4-color e-paper display. An ESP32 drives a 13.3" GDEY133F91 panel and exposes an HTTP push API. A web app manages what the display shows — scheduling entries, hosting editors, running generator plugins — and pushes frames to the firmware through a Cloudflare tunnel.

The firmware owns the panel, the refresh contract, and rate limiting. The web app is a higher-level scheduler that decides *what* to push and *when*.

## Hardware

| Part | Role |
|---|---|
| [GDEY133F91](hardware/display/gdey133f91.md) | 13.3" 4-color (R/Y/B/W) e-paper, 960×680, SPI, SSD2677 driver IC |
| [ESP32-L](hardware/board/esp32-l-board.md) | ESP32-WROOM-32D dev board, WiFi, USB-C powered, always-on |
| [DESPI-C02](hardware/adapter/despi-c02.md) | 24-pin FPC ↔ ESP32-L adapter, plug-and-play |

The DESPI-C02 DIP switch must be set to the SSD-series RESE position (0.47 Ω) for the SSD2677.

## Goals

- Manage a library of "entries" — images that can appear on the display.
- Run a scheduler that picks one entry every N minutes based on weighted conditions.
- Let trusted guests submit one-off images via short-lived links.
- Provide a desktop canvas editor and a simplified mobile editor.
- Auto-refresh content via built-in generator plugins (weather, calendar).

## Non-goals

- Multi-display support. One panel.
- User-authored generator plugins. Plugins are code-only, built into the backend.
- Mutable framebuffers. Once committed, an entry's pixels are frozen.
- Server-side rendering of templates from user data. Generators are pure code.

## Design docs

### Firmware

- [Wire format](wire-format.md) — what bytes go on the wire
- [API](api.md) — endpoints, auth, status JSON
- [Refresh contract](refresh-contract.md) — state machine, cooldown, coalescing
- [Firmware](firmware.md) — build, flags, driver, memory, discovery
- [Out of scope](out-of-scope.md) — explicitly rejected options

### Web app

- [Architecture](architecture.md) — stack, deploy topology, repo layout
- [Data model](data-model.md) — tables, schemas, relationships
- [Scheduler](scheduler.md) — tick, conditions, lock, "display now"
- [Generators](generators.md) — plugin model, weather + calendar
- [Editor](editor.md) — canvas, dither, palette, desktop vs mobile
- [Entry drafts](entry-drafts.md) — modal, lifecycle, sharing, drafts list
- [Push delivery](push-delivery.md) — retry, confirmation, offline detection
- [Auth](auth.md) — GitHub OAuth, allowlists, routing
- [Config](config.md) — env-vs-DB split, `app_settings`
- [Ops](ops.md) — backups, migrations, logging, tests, CI/CD
- [Deploy runbook](deploy-runbook.md) — Coolify setup, first-deploy checklist

## Conventions

- Wire format and refresh contract: see [wire-format.md](wire-format.md), [refresh-contract.md](refresh-contract.md), [api.md](api.md). The web app is a client of that API and must respect it.
- Palette: 4 colors (black, white, yellow, red), 2 bits per pixel, 163,200 bytes per frame.
- Cooldown: 5 minutes between refreshes, enforced by firmware. The web scheduler runs at a slower cadence (default 30 min) so it never fights the cooldown in normal operation.
