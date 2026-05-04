# 019 — No fetch timeouts on push and confirm calls

**Type:** Bug
**Severity:** High

## Problem

The `fetch()` calls in the push pipeline have no timeout. If the display hangs or is unreachable without rejecting, the request blocks indefinitely, stalling the scheduler.

`health/poll.ts` correctly uses `AbortSignal.timeout(10_000)` but the push calls do not.

## Where

- `src/web/server/push/push-frame.ts:72` — status check fetch, no timeout
- `src/web/server/push/push-frame.ts:91` — framebuffer POST fetch, no timeout
- `src/web/server/push/confirm.ts:37` — confirmation fetch, no timeout
- `src/web/server/health/poll.ts:30` — has timeout (good example to follow)

## Fix

Add `signal: AbortSignal.timeout(10_000)` (or a configurable value) to all three fetch calls. Match the pattern already used in `poll.ts`.
