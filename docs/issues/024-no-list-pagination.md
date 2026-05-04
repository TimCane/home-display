# 024 — No pagination on entry and draft list queries

**Type:** Improvement
**Priority:** Medium

## Problem

`entry.list` and `draft.list` return the entire table with no limit or offset. As data grows, response sizes and query times will increase unboundedly.

## Where

- `src/web/server/trpc/routers/entry.ts:10-27` — `list` query with no limit/offset
- `src/web/server/trpc/routers/draft.ts:46-91` — `list` query with no limit/offset

## Fix

Add optional `skip`/`take` input parameters (with sensible defaults like `take: 50`) and apply `.offset()` / `.limit()` to the queries. Update the UI pages to support pagination or infinite scroll.
