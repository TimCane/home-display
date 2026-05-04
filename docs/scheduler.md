# Scheduler

The scheduler picks one entry per tick and pushes its framebuffer to the firmware. No fixed rotation, no minimum dwell — selection is conditional + weighted random.

## Tick

Driven by `node-cron` using the cron expression in `app_settings.scheduler_cron`. Default: `*/30 * * * *` (every 30 minutes, wall-clock).

The 30-minute default sits comfortably above the firmware's 5-minute cooldown, so a normal tick never queues. Display-now and lock changes can hit cooldown — the firmware's coalesce + queue handles those (latest wins).

## Selection algorithm

```
on tick:
  if system_state.lock_entry_id is set:
    update last_shown_at = now() on the locked entry
    return
  candidates = entries WHERE
      enabled = true
      AND id != system_state.currently_displayed_entry_id
      AND every condition in conditions matches now()
  if candidates is empty:
    log "no candidates"; return
  for each candidate:
    score = base_weight * decay(last_shown_at)
    if show_count == 0:
      score += app_settings.first_view_boost
  winner = weighted_random(candidates by score)
  push winner; on success update currently_displayed_entry_id and last_shown_at
```

### Decay function

`decay(last_shown_at) = 1 - exp(-hours_since_shown / app_settings.decay_half_life_hours)` — saturates near 1 after ~2× the half-life, near 0 immediately after a show. The goal: "do not pick the same thing again until other candidates have had their turn." Default 12h means an entry recovers ~half its weight in 12h and ~95% in 36h — tuned so a small library cycles, a large library still favors freshness.

A never-shown entry (`show_count == 0`) gets the global `app_settings.first_view_boost` added on top. Used to guarantee a guest's first view jumps the queue. Per-entry overrides — "this one entry should jump harder" — are not modeled; express them via conditions if ever needed.

### Same-entry-no-repeat

The currently-displayed entry is excluded from the candidate set every tick. If it would be the only eligible candidate, the tick is a no-op ("no candidates"). The panel keeps showing it (bistable). This is intentional — repeating a push wastes a refresh and shortens panel life.

## Conditions

Closed enum. AND-ed. Empty array = always eligible.

| `type` | `params` | Eligible when |
|---|---|---|
| `time_window` | `{from: "07:00", to: "09:00"}` | Now is within the window in `app_tz`. Crosses midnight if `from > to`. |
| `day_of_week` | `{days: ["mon","tue",...]}` | Today (in `app_tz`) is in the set. |
| `date_range` | `{from?: "2026-12-20", to?: "2026-12-26"}` | Today is within the range, inclusive. Both endpoints optional — omit `from` for "until X," omit `to` for "from X onwards." A `to` in the past triggers the auto-disable sweep. |
| `manual_flag` | `{flag: "guests_over"}` | `system_state.flags[flag] === true`. Flags are not separately declared — the dashboard discovers them by scanning every entry's `conditions` for `manual_flag` references and renders a toggle per distinct flag name. Missing key reads as `false`. |
| `freshness` | `{not_shown_in_last_hours: 24}` | `last_shown_at` is null OR older than N hours. |
| `recently_updated` | `{updated_within_hours: 6}` | The entry's `updated_at` is within N hours. Useful to suppress stale generator output (a generator whose source feed has gone silent stops bumping the row). |

Adding new types = add Zod schema + evaluator function + UI form. No migration required (conditions are JSONB).

## Auto-disable sweep

A separate node-cron job runs every 10 minutes and flips `enabled = false` on any row whose `conditions` imply it can never match again. V1 detects one shape:

- A `date_range` condition with a `to` date strictly before today (in `app_tz`) and no `from` in the future.

Because the entry is AND-ed across conditions, an unsatisfiable predicate makes the whole entry permanently ineligible. Flipping `enabled = false`:
- Surfaces the transition in the admin UI (the entry shows as disabled, not "eligible-but-no-conditions-match").
- Avoids re-checking the dead predicate every tick.
- Forces re-enabling to be an explicit admin action.

Granularity is the sweep cadence (10 min). The condition framework is the source of truth either way; the sweep is just a state-cleanup pass.

## Lock

`system_state.lock_entry_id` is set/cleared via the admin UI. Two ways to set:
- "Lock to current" button (one click on the displayed entry)
- "Lock to this" button on any entry

While locked:
- Scheduler ticks skip selection.
- The locked entry's `last_shown_at` is updated every tick anyway, so when unlocked the no-repeat rule still suppresses it briefly.
- "Display now" on a *different* entry succeeds and updates the lock pointer to that new entry. (Lock and display-now are kept in sync.)

## Display now

A per-entry one-shot push triggered from the admin UI. Bypasses scheduling rules:
- Works on disabled entries.
- Works on entries whose conditions don't currently match.
- Works while locked, and updates the lock pointer.
- Updates `last_shown_at` on success.

## Push triggers

Canonical list lives in [push-delivery.md](push-delivery.md#push-triggers).

## Concurrency

Tick fires while a previous push is mid-flight: the scheduler runs anyway, picks a winner, and calls `push()`. The push function is responsible for serializing — if a push is already in flight, the new pick is dropped and logged. The firmware's coalescing means dropping is safe (the in-flight one will deliver; the next tick will pick again).

## Push log

Every push attempt is recorded in `push_log` (forever retention). See [push-delivery.md](push-delivery.md) for retry semantics.

## Empty / misconfigured states

- Empty DB on first deploy: scheduler ticks return "no candidates"; panel keeps whatever it was showing pre-deploy. No init image, no test pattern. (Test pattern is on-demand from the diagnostics page.)
- All entries disabled / no conditions match for many ticks: admin UI shows a prominent "no eligible candidates" warning on the dashboard.
