# Step 16 — Built-in generators (weather + calendar)

## Goal

Implement the two V1 plugins from [generators.md § V1 plugins](../generators.md#v1-plugins): weather (open-meteo) and calendar (ICS), each with two renderers.

## Depends on

Steps 6, 15.

## Files

- `src/web/server/generators/weather/index.ts` — plugin definition
- `src/web/server/generators/weather/fetch.ts` — open-meteo client
- `src/web/server/generators/weather/renderers/today.ts`
- `src/web/server/generators/weather/renderers/5day.ts`
- `src/web/server/generators/calendar/index.ts`
- `src/web/server/generators/calendar/fetch.ts` — ICS parser
- `src/web/server/generators/calendar/renderers/today-tomorrow.ts`
- `src/web/server/generators/calendar/renderers/5day.ts`
- `src/web/server/generators/index.ts` — `registerBuiltins()`

## Tasks

1. **Weather plugin:**
   - Config Zod: `{location: {lat, lon, name}, units: 'metric' | 'imperial'}`.
   - Fetcher: open-meteo `/v1/forecast` with current + hourly + daily fields. No API key needed.
   - Renderers use a server-side canvas (`@napi-rs/canvas` or `canvas` for Node) to render into RGBA, then run shared `dither` → 2bpp bytes.
   - `today`: current temp big, condition icon, today's high/low, hourly temp curve.
   - `5day`: five day cards with high/low + condition icon.
2. **Calendar plugin:**
   - Config Zod: `{ics_url: string, calendar_name: string}`.
   - Fetcher: GET ICS, parse with `node-ical` or `ical.js`.
   - `today_tomorrow`: two-column list of today + tomorrow events sorted by start.
   - `5day`: agenda-style list across the next five days.
3. Both plugins:
   - Use the shared palette + dither from step 6; never bake palette colors at render time.
   - Use `app_settings.app_tz` for date-bucketing.
   - On no events / no data, render a clean "no events"/"no data" frame rather than throwing.
4. `registerBuiltins()` is called by `boot.ts` (or wherever step 15 left the registration hook).

## Acceptance

- Creating a weather instance with valid coords → first run lands in `generator_runs` with `succeeded=true`, the placeholder `entries.framebuffer` is replaced.
- Calendar instance with a known public ICS URL renders a frame with the expected events.
- Open-meteo or ICS endpoint failure → `generator_runs` `succeeded=false`, previous frame untouched.
- Visual sanity check: framebuffer decoded back via `/api/framebuffer/<id>` shows the rendered output.

## Notes

- Server-side canvas adds a non-trivial native dep; pin Node version and confirm it works in the Docker base image.
- Icon set: bundle a small set of weather glyphs (sun/cloud/rain/snow/thunder) as bitmap PNGs or as paths drawn on canvas.
