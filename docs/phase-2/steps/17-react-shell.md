# Step 17 — React shell

## Goal

Build the SPA skeleton: routing, layout, auth bounce handling, tRPC client, shadcn/ui + Tailwind. No real pages yet — just the chrome and a placeholder for each route.

## Depends on

Steps 8 (auth), 12 (tRPC).

## Files

- `src/web/client/main.tsx`
- `src/web/client/App.tsx` — router + layout
- `src/web/client/layout/Sidebar.tsx`, `Topbar.tsx`
- `src/web/client/trpc.ts` — tRPC client + React Query setup
- `src/web/client/auth.ts` — handle 401s by redirecting to `/api/auth/login`
- `src/web/client/pages/*` — empty/placeholder components
- `tailwind.config.js`, `postcss.config.js`, `src/web/client/index.css`
- `components.json` (shadcn config)

## Tasks

1. Install `react-router-dom`, `@tanstack/react-query`, `@trpc/react-query`, `@trpc/client`, `tailwindcss`, `postcss`, `autoprefixer`. Init shadcn/ui.
2. Routes:
   - `/` → Dashboard
   - `/entries` → Entries list
   - `/drafts` → Drafts list
   - `/generators` → Generators
   - `/settings` → Settings
   - `/diagnostics` → Diagnostics
   - `/editor/:uuid` → Editor (placeholder; lands in step 19+)
3. Layout: sidebar nav (admin pages), topbar with `[+]` button (modal lands in step 19) and current-user/logout.
4. tRPC client wired with credentials so the session cookie flows. Global `onError` handler: on 401 → `window.location = '/api/auth/login'`.
5. Tailwind set up against shadcn defaults; smoke-test by rendering a `Button` and a `Card`.
6. Each placeholder page calls one trivial tRPC query (e.g. `entry.list`) so we can prove the wiring end to end.

## Acceptance

- `pnpm dev`, log in via OAuth, land on `/` and see the layout with the sidebar.
- Each admin route renders without console errors.
- Logging out (`POST /api/auth/logout`, then a tRPC call) bounces back to login.
- shadcn components render with Tailwind styles.

## Notes

- `/editor/:uuid` is the only route the SPA bounce middleware leaves alone; it gets its own per-draft gate inside the page in step 19.
- No Storybook, no design tokens — we lean on shadcn defaults.
