# Step 12 — Scheduler

## Goal

Implement the tick, weighted-random selection, lock semantics, `displayNow`, and the auto-disable sweep, all per [scheduler.md](../scheduler.md).

## Depends on

Steps 6 (conditions evaluator), 6 (settings), 9 (pushFrame), 10 (health cron pattern).

## Files

- `src/web/server/scheduler/tick.ts` — selection + push orchestration
- `src/web/server/scheduler/score.ts` — `decay()` + scoring
- `src/web/server/scheduler/select.ts` — weighted random
- `src/web/server/scheduler/lock.ts` — set/clear lock; `last_shown_at` bump on locked tick
- `src/web/server/scheduler/display-now.ts` — bypass-rules push
- `src/web/server/scheduler/auto-disable.ts` — separate cron sweep
- `src/web/server/scheduler/cron.ts` — register tick + sweep crons; re-register on settings change
- `src/web/server/boot.ts` — start scheduler

## Tasks

1. `tick()`:
   - If `system_state.lock_entry_id` set: bump locked entry's `last_shown_at = now()`; return.
   - Else SELECT candidates: `enabled = true`, `id != currently_displayed_entry_id`, all conditions match `now()` (in `app_tz`).
   - If empty → log `no candidates`; return.
   - Score each: `base_weight * decay(last_shown_at, half_life_hours) + (show_count == 0 ? first_view_boost : 0)`.
   - Weighted-random pick.
   - Call `pushFrame({entryId, trigger: 'tick'})`. On success: update `currently_displayed_entry_id`, `last_shown_at`, `show_count++`. (Done in a single transaction with the push success.)
2. `decay(t, halfLifeH) = 1 - exp(-hoursSince(t) / halfLifeH)` with sane handling of `null` (treat as fully decayed → returns 1).
3. `displayNow(entryId)`:
   - Read entry (no enabled / conditions check).
   - Call `pushFrame({entryId, trigger: 'display_now'})`.
   - On success: update `currently_displayed_entry_id`, `last_shown_at`. If currently locked, update `lock_entry_id` to this entry too (lock + display-now stay in sync).
4. `setLock(entryId)` / `clearLock()`:
   - Update `system_state`.
   - On `setLock` to a different entry, also `pushFrame({entryId, trigger: 'lock_change'})`.
5. Auto-disable sweep: every 10 min, scan `entries.conditions` for the `date_range`-with-past-`to` shape; flip `enabled = false`. Idempotent.
6. Register tick cron from `app_settings.scheduler_cron`; subscribe to changes; re-register.

## Acceptance

- With mock display + a couple of seeded enabled entries: tick fires, picks one, pushes it, updates state.
- Lock to an entry: subsequent ticks no-op but `last_shown_at` keeps bumping.
- `displayNow` on a disabled entry succeeds.
- An entry whose only condition is `date_range to=2020-01-01` gets auto-disabled within 10 min.
- Decay function behaves: never-shown entry beats just-shown entry of equal weight in repeated trials.

## Notes

- Coalescing in-flight pushes is `pushFrame`'s job; the scheduler just calls it.
- See [scheduler.md § Selection algorithm](../scheduler.md#selection-algorithm) for the canonical pseudocode.
