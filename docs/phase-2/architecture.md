# Architecture

## Stack

| Layer | Choice |
|---|---|
| Frontend | React + Vite + React Router (SPA) |
| UI components | shadcn/ui + Tailwind |
| Data layer | tRPC (typed end-to-end) |
| Backend | Node + TypeScript, Hono HTTP server |
| ORM | Drizzle |
| DB | Postgres (Coolify-managed) |
| Job scheduling | node-cron, in-process |
| Logging | pino → stdout |
| Auth (admin) | GitHub OAuth, allowlist via env |
| Deploy | Coolify on Hetzner via docker-compose |
| External access (firmware) | Cloudflare tunnel from home network |

The backend is a single Node container that serves the tRPC API at `/api/*` and the built React static assets at `/*`. Same origin, no CORS. Postgres is a sibling container in the same `docker-compose.yml`.

## Topology

```
┌──────────────┐       https        ┌──────────────────────┐
│ Browser /    │ ──────────────────►│  display.<domain>     │
│ Phone        │                    │  (Coolify, Hetzner)   │
└──────────────┘                    │                       │
                                    │  Node + Hono + tRPC   │
                                    │  ───────────          │
                                    │  Drizzle              │
                                    │  ───────────          │
                                    │  Postgres             │
                                    └──────┬───────────────┘
                                           │  POST /fb (bearer token)
                                           │  GET /status
                                           ▼
                                    cloudflared tunnel
                                           │
                                           ▼
                                    ESP32 firmware
                                    (home LAN)
```

Single domain. Auth/routing rules: see [auth.md](auth.md#routing-matrix).

## Surface

The full set of URLs the backend serves. Auth gates for each path live in [auth.md](auth.md#routing-matrix); this section is the catalog.

### Admin SPA pages

All require admin session. Middleware on `/*` (excluding `/editor/*` and `/api/*`) bounces unauthenticated requests to `/api/auth/login`.

| Path | Purpose |
|---|---|
| `/` | Dashboard — current display, online/offline indicator, manual flag toggles, "lock to current" / "unlock" |
| `/entries` | Entries list — library view, edit metadata (`enabled`, `base_weight`, `conditions`), "display now," "lock to this," delete |
| `/drafts` | Drafts list — see [entry-drafts.md](entry-drafts.md#drafts-list-page) |
| `/generators` | Generator instances — one tab per registered plugin, create/edit/delete instances, "run now" |
| `/settings` | `app_settings` editor — palette, scheduler cron, timezone, health-check cadence, weight constants, display URL/token |
| `/diagnostics` | See [ops.md](ops.md#diagnostics-page) |

### Editor / public pages

| Path | Purpose | Auth |
|---|---|---|
| `/editor/<uuid>` | Authoring surface for one draft | UUID; admin session also required for non-guest drafts |

### Backend HTTP endpoints (non-tRPC)

| Path | Method | Purpose |
|---|---|---|
| `/api/auth/login` | GET | Begin GitHub OAuth |
| `/api/auth/callback` | GET | OAuth callback |
| `/api/auth/logout` | POST | Clear session |
| `/api/health` | GET | Public; returns `{ok: true}` for Coolify |
| `/api/sse/system` | GET | Server-Sent Events stream for live `system_state` updates (online/offline, lock, currently displayed). Admin session. |
| `/api/framebuffer/<entry_id>` | GET | Raw 163,200-byte payload for client-side decode (preview tiles, current-display view). Admin session. |

### tRPC routers

Mounted at `/api/trpc/<router>.<procedure>`. All require admin session unless noted. Naming convention: singular noun + verb.

| Router | Procedures |
|---|---|
| `entry` | `list`, `get`, `update`, `delete`, `displayNow` |
| `draft` | `create`, `list`, `get`, `revoke`, `commit` (`get` and `commit` accept the UUID-as-bearer path; admin session is required only when the draft is non-guest — see [auth.md](auth.md#editor-auth--uuid-as-bearer--optional-admin-gate)) |
| `generator` | `listPlugins`, `listInstances`, `createInstance`, `updateInstance`, `deleteInstance`, `runNow`, `recentRuns` |
| `settings` | `getAll`, `set` |
| `system` | `lock`, `unlock`, `setFlag`, `pushTestPattern` |
| `diagnostics` | `recentPushes`, `statusHistory`, `latestStatus`, `generatorRuns` |

Adding a procedure = code change in `src/web/server/trpc/`; no infrastructure change.

### Backend → firmware (egress)

| Path | Method | Notes |
|---|---|---|
| `<display_base_url>/fb` | POST | 163,200-byte body, bearer token. See [push-delivery.md](push-delivery.md). |
| `<display_base_url>/status` | GET | Bearer token. See [push-delivery.md#health-checks](push-delivery.md#health-checks). |

## Repo layout

The phase-1 firmware moves under `src/firmware/`. The web app lives under `src/web/`. Shared at the repo root: `package.json` (web), `platformio.ini` (firmware), `docker-compose.yml`, `Dockerfile`, top-level `docs/`.

```
new-home-display/
  package.json              # web app
  tsconfig.json
  drizzle.config.ts
  Dockerfile
  docker-compose.yml        # node + postgres
  platformio.ini            # firmware (src_dir=src/firmware, test_dir=test/firmware)
  src/
    firmware/               # phase 1, moved
      main.cpp
      app/ display/ http/ net/ persist/ config/
    web/
      server/               # Hono backend, tRPC, scheduler, generators
        index.ts
        db/                 # Drizzle schema + migrations
        trpc/               # routers
        scheduler/
        generators/
          weather/
          calendar/
        mock-display/       # dev-mode mock /fb endpoint
      client/               # React + Vite
        main.tsx
        pages/admin/
        pages/guest/
        editor/             # desktop + mobile editors
      shared/               # imported by both server/ and client/
        dither.ts
        framebuffer.ts      # 2bpp encode/decode
        conditions.ts       # zod schemas + evaluators
        palette.ts
  test/
    firmware/               # phase 1 Unity tests, moved
    web/                    # Vitest, dither + framebuffer tests only
  docs/
    README.md
    api.md wire-format.md refresh-contract.md firmware.md out-of-scope.md
    hardware/
    phase-2/                # this directory
```

`src/web/shared/` is load-bearing: anything that *must* match between client and server (dither, palette, framebuffer encode, condition schemas) lives here. Importing it from both sides guarantees they can't drift.

## Build & deploy

- `pnpm dev` (or `npm run dev`): Vite dev server proxies `/api` to a local Node server. Backend points at the mock display unless `DISPLAY_BASE_URL` is overridden in the dev DB.
- `pnpm build`: Vite static build → emitted into the Node server's static dir. Single `pnpm start` serves both.
- Production: GitHub Actions runs typecheck + dither tests on PR. Push to `main` triggers a Coolify webhook, which rebuilds the docker-compose stack and restarts containers. Drizzle migrations run in the container's entrypoint before the app starts.
