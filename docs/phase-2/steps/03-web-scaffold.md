# Step 3 — Web app scaffold

## Goal

Stand up the minimal Node + React shell so `pnpm dev` brings up both the backend and the Vite dev server with `/api/*` proxied. No business logic.

## Depends on

Step 2.

## Files

- `package.json`, `pnpm-lock.yaml`
- `tsconfig.json` (root) + `tsconfig.server.json` / `tsconfig.client.json` if split
- `vite.config.ts`
- `src/web/server/index.ts` — Hono app exposing `GET /api/health` returning `{ok: true}`
- `src/web/client/main.tsx`, `src/web/client/index.html`, `src/web/client/App.tsx` — placeholder page
- `.gitignore` — `node_modules`, `dist`, `.env`

## Tasks

1. Init pnpm project. Pin Node version via `engines` and (optionally) `.nvmrc`.
2. Install deps: `hono`, `@hono/node-server`, `react`, `react-dom`, `vite`, `@vitejs/plugin-react`, `typescript`, `tsx` (or `tsup`/`esbuild` for server dev).
3. Add `pnpm dev` that runs the Hono server (`tsx watch src/web/server/index.ts`) **and** Vite (`vite`) concurrently. Vite proxies `/api/*` → `http://localhost:<server_port>`.
4. Add `pnpm build` (Vite static build → `dist/client`) and `pnpm start` (Node serves API + static `dist/client`).
5. Add `pnpm typecheck` running `tsc --noEmit` over both server and client.
6. Hono serves built static assets at `/*` in production; in dev, Vite owns `/*` and proxies `/api/*`.

## Acceptance

- `pnpm dev` → browser at Vite's URL shows the placeholder page; `curl /api/health` returns `{ok: true}` through the proxy.
- `pnpm build && pnpm start` → single port serves both the static SPA and `/api/health`.
- `pnpm typecheck` passes.

## Notes

- No router, no shadcn, no tRPC yet. All of that lands in later steps.
- See [architecture.md § Build & deploy](../architecture.md#build--deploy).
