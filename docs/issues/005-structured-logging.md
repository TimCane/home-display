# 005 — No structured logging

**Type:** Improvement
**Priority:** High

## Problem

The docs specify pino for structured JSON logging, but the entire server uses bare `console.log`, `console.error`, and `console.warn` (~30 call sites). This means:

- No structured JSON output for Coolify log ingestion
- No log levels (can't filter debug vs info vs error)
- No request context (no request ID, no user, no duration)
- No consistent format across subsystems

## Where

All server-side code. Major call sites:

- `server/boot.ts` — 9 boot progress logs
- `server/scheduler/tick.ts` — 5 scheduler event logs
- `server/scheduler/cron.ts` — 4 cron registration logs
- `server/generators/runtime.ts` — 5 generator lifecycle logs
- `server/health/poll.ts` — 1 transition log
- `server/health/cron.ts` — 2 logs
- `server/index.ts` — 1 startup log
- `server/mock-display/index.ts` — 1 dev-only log

## Fix

1. Add `pino` as a dependency.
2. Create a shared logger instance in `server/logger.ts`.
3. Replace all `console.*` calls with the appropriate pino level (`logger.info`, `logger.error`, `logger.warn`).
4. Add request logging middleware to Hono (pino-http or manual).
