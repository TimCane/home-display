# 031 — No integration or E2E tests

**Type:** Improvement
**Priority:** Low

## Problem

The test suite has 55 unit tests covering shared logic (framebuffer, dithering, conditions, config). There are no tests for tRPC endpoints, database operations, the push pipeline, or the scheduler tick — the most critical server-side flows.

## Where

- `test/web/` — 6 test files, all unit-level
- No tests for `src/web/server/trpc/routers/`
- No tests for `src/web/server/scheduler/tick.ts`
- No tests for `src/web/server/push/`

## Fix

Add integration tests using a test database (e.g. via `docker compose` in CI) that exercise:

1. Entry CRUD via tRPC
2. Draft creation → commit flow
3. Scheduler tick with known entry state
4. Generator run cycle

Vitest is already configured; these tests just need a DB setup/teardown helper.
