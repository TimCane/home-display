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

Single domain. Routing:

| Path | Audience | Auth |
|---|---|---|
| `/editor/<uuid>` | Whoever has the link (guests for guest-mode drafts, admins for non-guest) | UUID-as-bearer; admin session also required for non-guest drafts |
| `/api/trpc/*` | Browser RPC | Session cookie |
| `/api/auth/*` | OAuth callback | — |
| `/*` (everything else) | Admin | GitHub OAuth, allowlisted |

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
