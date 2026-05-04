# 023 — Missing database indexes

**Type:** Improvement
**Priority:** Medium

## Problem

No indexes are defined beyond primary keys. The scheduler's `tick()` queries `entries` by `enabled` on every run, and other tables are queried by foreign keys without indexes — all full table scans.

## Where

- `src/web/server/db/schema.ts:23-143` — no index definitions on any table
- `src/web/server/db/migrations/0000_clammy_the_santerians.sql` — no CREATE INDEX statements

## Recommended Indexes

- `entries(enabled)` — filtered every scheduler tick
- `generatorRuns(instanceId, ranAt DESC)` — queried per instance for last run
- `displayStatusHistory(polledAt)` — ordered for diagnostics page
- `pushLog(entryId)` — filtered for push history
- `drafts(status)` — filtered on draft list page
