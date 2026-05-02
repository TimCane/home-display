# Phase 2 — Implementation steps

Ordered build plan for phase 2. Each step is a single commit-sized chunk that leaves the tree in a working state.

Each step doc has the same shape: **Goal**, **Depends on**, **Files**, **Tasks**, **Acceptance**, **Notes**.

| # | Step | File |
|---|---|---|
| 1 | Dev container | [01-devcontainer.md](01-devcontainer.md) |
| 2 | Restructure repo (firmware → `src/firmware/`) | [02-restructure-repo.md](02-restructure-repo.md) |
| 3 | Web app scaffold (Hono + Vite + React) | [03-web-scaffold.md](03-web-scaffold.md) |
| 4 | Docker + Postgres | [04-docker-postgres.md](04-docker-postgres.md) |
| 5 | Drizzle schema + initial migration | [05-drizzle-schema.md](05-drizzle-schema.md) |
| 6 | Shared core + golden-frame tests | [06-shared-core.md](06-shared-core.md) |
| 7 | Config layer + boot sequence | [07-config-boot.md](07-config-boot.md) |
| 8 | Auth + tRPC base | [08-auth-trpc-base.md](08-auth-trpc-base.md) |
| 9 | Mock display server | [09-mock-display.md](09-mock-display.md) |
| 10 | Push delivery | [10-push-delivery.md](10-push-delivery.md) |
| 11 | Health checks | [11-health-checks.md](11-health-checks.md) |
| 12 | Scheduler | [12-scheduler.md](12-scheduler.md) |
| 13 | tRPC routers + side endpoints | [13-trpc-routers.md](13-trpc-routers.md) |
| 14 | Drafts router + editor auth gate | [14-drafts.md](14-drafts.md) |
| 15 | Generator framework | [15-generator-framework.md](15-generator-framework.md) |
| 16 | Built-in generators (weather, calendar) | [16-builtin-generators.md](16-builtin-generators.md) |
| 17 | React shell | [17-react-shell.md](17-react-shell.md) |
| 18 | Admin pages | [18-admin-pages.md](18-admin-pages.md) |
| 19 | Draft modal + editor route | [19-draft-modal-editor-route.md](19-draft-modal-editor-route.md) |
| 20 | Desktop editor | [20-desktop-editor.md](20-desktop-editor.md) |
| 21 | Mobile editor | [21-mobile-editor.md](21-mobile-editor.md) |
| 22 | CI + deploy | [22-ci-deploy.md](22-ci-deploy.md) |
