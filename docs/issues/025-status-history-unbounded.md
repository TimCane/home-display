# 025 — displayStatusHistory grows unbounded

**Type:** Improvement
**Priority:** Medium

## Problem

A row is inserted into `displayStatusHistory` on every health poll (default every 5 minutes). There is no pruning or retention policy, so the table grows indefinitely — ~105k rows/year.

## Where

- `src/web/server/health/poll.ts:41-44` — inserts a row every poll, never deletes
- `src/web/server/db/schema.ts:123-131` — table definition with no TTL mechanism

## Fix

Add a periodic cleanup task (e.g. run daily) that deletes rows older than a retention period (e.g. 90 days). Can be a simple `DELETE WHERE polledAt < NOW() - INTERVAL '90 days'` run from an existing cron.
