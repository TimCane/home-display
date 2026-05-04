# 022 — N+1 query in generator listInstances

**Type:** Bug
**Severity:** Medium

## Problem

The `listInstances` query fetches all generator instances in one query, then runs a separate query per instance to get the last run. For N instances this is 1 + N queries.

## Where

- `src/web/server/trpc/routers/generator.ts:26-46` — fetches all instances (line 27-29), then maps over each with an async query for last run (lines 32-42)

## Fix

Replace the loop with a single query using a JOIN or lateral subquery to fetch each instance's most recent run in one round trip.
