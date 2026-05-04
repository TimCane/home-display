# 016 — Seed the random selection to show an upcoming entries list on the dashboard

**Type:** Improvement
**Priority:** Medium

## Problem

The dashboard only shows the currently displayed entry, some stats, and controls. It feels empty and gives no sense of what's coming next.

The scheduler uses `Math.random()` in `weightedRandom()` to pick entries, which is unseeded and unpredictable. This makes it impossible to preview the upcoming rotation — even though the scores are deterministic given the current state, the random draw is not.

## Where

- `src/web/server/scheduler/select.ts:22-25` — `Math.random()` calls with no seed
- `src/web/server/scheduler/tick.ts:76-98` — scoring and selection per tick
- `src/web/server/scheduler/score.ts` — deterministic scoring given entry state
- `src/web/client/pages/DashboardPage.tsx` — dashboard UI (currently has no upcoming list)

## Fix

### 1. Seedable PRNG

Replace `Math.random()` in `weightedRandom` with a seedable PRNG (e.g. a simple mulberry32 or xoshiro128 implementation — no external dependency needed).

Store a `schedulerSeed` in `system_state`. On each tick, derive the next seed from the current one (e.g. hash the previous seed), so the sequence is deterministic given the starting seed. Reseed when entries are added/removed/enabled/disabled or when conditions change, since those invalidate the predicted sequence.

### 2. Upcoming list endpoint

Add a tRPC query (e.g. `system.upcoming`) that:

1. Reads the current `schedulerSeed` and entry state
2. Simulates N ticks forward by running the same score → weightedRandom loop, advancing the seed and `lastShownAt` each step (in memory, not persisted)
3. Returns the predicted entry list (id, title, thumbnail) for the next N rotations

This is a projection — it stays accurate as long as no entries are added/removed/toggled, no conditions change, and no manual "display now" or lock overrides happen. The UI should make this clear.

### 3. Dashboard "Up Next" card

Add an "Up Next" card to `DashboardPage.tsx` showing the projected sequence (e.g. next 5-10 entries) with small thumbnails and titles. Include a note like "based on current schedule — changes if entries or conditions are modified".

This fills the empty dashboard space and gives users confidence about what the display will cycle through.
