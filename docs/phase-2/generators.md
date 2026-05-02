# Generators

Generators are built-in plugins that periodically rewrite the framebuffer of an entry they own. The scheduler treats their output identically to admin/guest entries — just an entry with a framebuffer and conditions.

## Architecture

A **plugin** is a code-only module that defines:
- A name (e.g. `weather`)
- A Zod schema for its config
- A *fetcher* that pulls and normalizes external data
- One or more **renderers** that produce a 163,200-byte framebuffer from the fetched data

An **instance** is a row in `generator_instances` that pairs a plugin + renderer + config. One instance owns exactly one entry (`entries` row), and rewrites that entry's framebuffer on its own cron schedule.

```
weather plugin
  fetcher: open-meteo API call → normalized forecast object
  renderers:
    today  → 163,200-byte frame
    5day   → 163,200-byte frame

instances (DB rows):
  { plugin: weather, renderer: today, config: {lat: 51.5, lon: -0.1, units: metric},
    cron: "*/30 * * * *", entry_id: <uuid> }
  { plugin: weather, renderer: 5day,  config: {lat: 51.5, lon: -0.1, units: metric},
    cron: "0 6 * * *",   entry_id: <uuid> }
```

Plugins are registered at boot. Adding a new plugin = code change + deploy.

## Lifecycle

1. Admin opens the plugin's UI page (one per plugin) and creates an instance: picks a renderer, fills config, sets a cron.
2. On instance creation: a placeholder `entries` row is inserted (default `enabled=false`, no conditions). The instance's cron is registered with node-cron.
3. On each cron firing:
   - Plugin's fetcher runs.
   - Plugin's renderer produces a framebuffer.
   - Backend writes `entries.framebuffer` and bumps an internal `framebuffer_updated_at` (used by the `recently_updated` condition).
   - A row is inserted in `generator_runs` (succeeded or error).
4. On instance update (config changed): re-register cron, optionally trigger an immediate run.
5. On instance delete: cascade-delete the owned entry, unregister cron.

## Ownership of entry fields

| Field | Owner |
|---|---|
| `framebuffer` | Plugin (rewrites on cron) |
| `title` | Plugin (derived from `instance_name` + renderer) |
| `enabled`, `conditions`, `base_weight`, `display_until`, `first_view_boost` | Admin (via normal entry edit UI) |

Generator entries appear in the main entry list with a badge ("owned by `weather:home-today`") and no direct delete button. The "Generators" admin page is where instances are created and removed.

## Error isolation

A generator's cron callback runs inside a `try/catch`. On exception:
- The error is caught, logged via pino.
- A row is inserted into `generator_runs` with `succeeded=false` and the error message.
- The entry's existing framebuffer is left untouched (the previous good frame stays scheduleable).
- The cron continues firing on its schedule.

The admin diagnostics page surfaces per-instance health: last successful run, last failure, error message.

## V1 plugins

### Weather (open-meteo)

- Source: [open-meteo](https://open-meteo.com) (free, no API key).
- Config: `{location: {lat, lon, name}, units: 'metric' | 'imperial'}`.
- Renderers:
  - `today` — current temperature, condition, today's high/low, hourly temp curve.
  - `5day` — five-day forecast cards with high/low and condition icons.

### Calendar (ICS)

- Source: ICS feed URL.
- Config: `{ics_url: string, calendar_name: string}`.
- Renderers:
  - `today_tomorrow` — today and tomorrow's events as a two-column list.
  - `5day` — next five days, agenda style.

## V1 deferred

- Tasks plugin. Source decision unresolved; adds new auth surface. Reconsider after V1 ships.
