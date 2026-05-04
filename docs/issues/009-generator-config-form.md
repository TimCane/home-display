# 009 — Generator config is a raw JSON textarea

**Type:** Improvement
**Priority:** High

## Problem

Creating a new generator instance requires typing raw JSON into a textarea for the plugin config. This is error-prone — the user gets unhelpful Zod validation errors like "expected object, received undefined" for nested fields they didn't know existed.

Example: the weather plugin expects `{ location: { lat, lon, name }, units: "metric" | "imperial" }` but there's no indication of this structure in the UI. The user has to guess or read the source code.

## Where

- `src/web/client/pages/GeneratorsPage.tsx` — instance create/edit form
- `src/web/server/generators/weather/index.ts` — weather config schema
- `src/web/server/generators/calendar/index.ts` — calendar config schema
- `src/web/server/trpc/routers/generator.ts` — `listPlugins` exposes schema JSON

## Current behaviour

`listPlugins()` returns `configSchemaJson` for each plugin. The UI renders a raw JSON textarea. Validation errors are dumped as raw Zod output.

## Fix

Render proper form controls derived from each plugin's config schema. Since plugins are built-in and there are only two, purpose-built forms are the simplest approach:

**Weather:**
- Location name (text input)
- Latitude (number input)
- Longitude (number input)
- Units (select: metric / imperial)

**Calendar:**
- ICS URL (text input, type=url)
- Timezone (text input or select from common IANA zones)

Implementation options:
1. **Per-plugin form components** — a `WeatherConfigForm` and `CalendarConfigForm` that the generators page renders based on `pluginName`. Simple, explicit, no abstraction needed for two plugins.
2. **Auto-generated from Zod schema** — libraries like `@autoform/react` or `react-hook-form` with Zod resolvers can render forms from schemas. More work upfront but scales if more plugins are added.

Option 1 is recommended — two small forms are less complexity than a schema-to-form engine.
