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
   - Backend writes `entries.framebuffer`; `updated_at` bumps as a side-effect (drives the `recently_updated` condition).
   - A row is inserted in `generator_runs` (succeeded or error).
4. On instance update (config changed): re-register cron, optionally trigger an immediate run.
5. On instance delete: cascade-delete the owned entry, unregister cron.

## Ownership of entry fields

| Field | Owner |
|---|---|
| `framebuffer` | Plugin (rewrites on cron) |
| `title` | Plugin (derived from `instance_name` + renderer) |
| `enabled`, `conditions`, `base_weight` | Admin (via normal entry edit UI) |

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

### Holiday Weather (open-meteo)

- Source: [open-meteo](https://open-meteo.com) (free, no API key).
- Config: `{trips: [{name, location: {lat, lon, name}, startDate, endDate}], units}`.
- Renderers:
  - `cards` — card grid of upcoming trips with weather forecasts and countdown.

## V2 plugins

Detailed design docs in [`generators/`](generators/).

### [Bin Collection](generators/bin-collection.md)

- Source: UK council ICS feeds or JSON APIs.
- Renderers: `next` (next collection, hero layout), `week` (this week's schedule).

### [Quote of the Day](generators/quote.md)

- Source: [ZenQuotes](https://zenquotes.io) (free, no API key).
- Renderers: `daily` (centered typographic layout).

### [Word of the Day](generators/word-of-the-day.md)

- Source: [Free Dictionary API](https://dictionaryapi.dev/) + curated word list (free, no API key).
- Renderers: `daily` (dictionary card with word, phonetic, definition, example).

### [On This Day](generators/on-this-day.md)

- Source: [Wikipedia On This Day API](https://api.wikimedia.org/wiki/Feed_API/Reference/On_this_day) (free, no API key).
- Renderers: `today` (timeline of 3–4 historical events).

### [Astronomy](generators/astronomy.md)

- Source: [open-meteo](https://open-meteo.com) + local moon phase calculation (free, no API key).
- Renderers: `today` (sun arc, sunrise/sunset, daylight change, moon phase, golden hour).

### [Pollen & Air Quality](generators/pollen-aqi.md)

- Source: [Open-Meteo Air Quality API](https://open-meteo.com/en/docs/air-quality-api) (free, no API key).
- Renderers: `today` (AQI gauge, pollutant readings, pollen bars).

## V2 deferred

- **Tasks plugin.** Source decision unresolved; adds new auth surface. Reconsider after V2 ships.
- **Marine / Surf.** Open-Meteo has a [Marine API](https://open-meteo.com/en/docs/marine-weather-api) with wave height, swell period/direction, and sea surface temperature. Would make a good plugin for coastal locations but niche — revisit if there's demand.
- **Flood risk.** Open-Meteo has a [Flood API](https://open-meteo.com/en/docs/flood-api) with river discharge forecasts (GloFAS data, 5 km resolution). Useful near rivers but very niche.
- **Climate trends.** Open-Meteo has a [Climate Change API](https://open-meteo.com/en/docs/climate-api) with downscaled IPCC projections. Interesting for a "this month vs historical average" comparison but the display cadence (daily/weekly) doesn't suit long-term projections well.
