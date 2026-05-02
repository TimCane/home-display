# Phase 2 — Web interface

A web app that manages what the display shows. React frontend + Node/TypeScript backend, hosted on Hetzner via Coolify, pushes frames to the firmware through a Cloudflare tunnel.

The firmware (phase 1) is unchanged. It still owns the panel, the refresh contract, and the bearer-token API. Phase 2 is a higher-level scheduler that decides *what* to push and *when*.

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

- [Architecture](architecture.md) — stack, deploy topology, repo layout
- [Data model](data-model.md) — tables, schemas, relationships
- [Scheduler](scheduler.md) — tick, conditions, lock, "display now"
- [Generators](generators.md) — plugin model, weather + calendar V1
- [Editor](editor.md) — canvas, dither, palette, desktop vs mobile
- [Guest links](guest-links.md) — lifecycle, sharing, submission
- [Push delivery](push-delivery.md) — retry, confirmation, offline detection
- [Auth](auth.md) — GitHub OAuth, allowlists, routing
- [Config](config.md) — env-vs-DB split, `app_settings`
- [Ops](ops.md) — backups, migrations, logging, tests, CI/CD

## Conventions inherited from phase 1

- Wire format and refresh contract: see [phase 1 docs](../wire-format.md), [refresh-contract.md](../refresh-contract.md), [api.md](../api.md). The web app is a client of that API and must respect it.
- Palette: 4 colors (black, white, yellow, red), 2 bits per pixel, 163,200 bytes per frame.
- Cooldown: 5 minutes between refreshes, enforced by firmware. The web scheduler runs at a slower cadence (default 30 min) so it never fights the cooldown in normal operation.
