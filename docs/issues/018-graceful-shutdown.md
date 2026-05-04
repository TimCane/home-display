# 018 — No graceful shutdown

**Type:** Bug
**Severity:** High

## Problem

The server has no SIGTERM/SIGINT handlers. When the container stops, in-flight pushes, scheduled ticks, and database connections are killed without cleanup.

`stopSchedulerCron()` exists in `scheduler/cron.ts` but is never called during shutdown.

## Where

- `src/web/server/index.ts:104-110` — `main()` starts the server with no signal handlers
- `src/web/server/scheduler/cron.ts:56-65` — `stopSchedulerCron()` exists but is never wired to shutdown

## Fix

Add signal handlers in `index.ts` that:

1. Stop accepting new HTTP connections
2. Call `stopSchedulerCron()` and stop generator crons
3. Wait for in-flight requests/pushes to complete (with a timeout)
4. Close the database pool
5. Exit cleanly
