# Generator: Bin Collection

Shows upcoming household waste and recycling collection days. Designed for UK councils but the fetcher abstraction allows other sources.

## Source

UK councils expose collection schedules in various formats. The fetcher uses a pluggable adapter pattern to support different council APIs:

- **ICS feed** — many councils publish a `.ics` URL per address. The fetcher parses it with the same `ical.js` dependency used by the calendar plugin.
- **JSON API** — some councils (or aggregators like [Waste Collection API](https://github.com/robbrad/UKBinCollectionData)) return structured JSON.

The adapter is selected by `source_type` in the config. Adding a new council = adding an adapter function, not a new plugin.

### Data shape (normalised)

```ts
interface BinCollectionData {
  collections: {
    date: string;          // YYYY-MM-DD
    binType: string;       // e.g. "general", "recycling", "garden", "food"
    label: string;         // Display name, e.g. "Black Bin", "Green Bin"
    color: string;         // Hint for rendering: "black" | "green" | "blue" | "brown" | "grey"
  }[];
  lastUpdated: string;     // ISO timestamp
}
```

## Config

```ts
z.object({
  source_type: z.enum(["ics", "json"]),
  // ICS source
  ics_url: z.string().url().optional(),
  // JSON source
  api_url: z.string().url().optional(),
  address_id: z.string().optional(),
  // Display
  council_name: z.string().min(1),
})
```

At least one source must be provided. Validated with a Zod `refine`.

## Renderers

### `next`

Shows the next upcoming collection in a bold, single-focus layout.

```
┌──────────────────────────────────────────────────┐
│  ██  BIN DAY                          council    │  ← black header bar, yellow accent
├──────────────────────────────────────────────────┤
│                                                  │
│              ┌──────────────┐                    │
│              │   🗑  icon   │                    │  ← large bin icon, colour-coded
│              │              │                    │
│              └──────────────┘                    │
│                                                  │
│              RECYCLING                           │  ← bin type, bold
│           Blue Bin & Box                         │  ← bin label
│                                                  │
│        ┌─────────────────────┐                   │
│        │   TOMORROW          │                   │  ← countdown pill (red/yellow)
│        └─────────────────────┘                   │
│                                                  │
│           Wednesday 7 May                        │  ← full date
│                                                  │
└──────────────────────────────────────────────────┘
```

- If collection is today: yellow pill, "PUT BINS OUT!"
- If collection is tomorrow: yellow pill, "TOMORROW"
- Otherwise: red pill, "in N days"
- If no upcoming collection found: "No collections scheduled"

### `week`

Shows this week's collection schedule at a glance — one row per collection day.

```
┌──────────────────────────────────────────────────┐
│  ██  THIS WEEK                        council    │  ← black header bar
├──────────────────────────────────────────────────┤
│                                                  │
│  ● Mon 5 May    ─────────  General (Black)       │
│                            Food (Brown)          │
│                                                  │
│  ● Thu 8 May    ─────────  Recycling (Blue)      │
│                                                  │
│                                                  │
│                  No more this week               │  ← if only 1-2 days have collections
│                                                  │
└──────────────────────────────────────────────────┘
```

- Colour dots next to each day use the bin colour (mapped to the 4-colour palette: black→black, green/blue→black with a label, brown→red, grey→black).
- Past days within the week are dimmed (lighter stroke / smaller text).
- Yellow accent line separates today from future days.

## Cron

Default: `0 6 * * *` (daily at 06:00). Collection schedules change infrequently; daily is plenty.

## Error handling

Standard generator error isolation. On fetch failure the previous frame stays. Council APIs are often unreliable, so the fetcher retries once with a 3-second delay before recording an error run.

## Notes

- Bin type → colour mapping is a static lookup in the renderer, not config. The 4-colour palette limits what's possible, so we use shape/icon + label to distinguish bin types that map to the same display colour.
- The `color` field in the data shape is a rendering hint only — the actual display colour is quantised to black/white/yellow/red during `canvasToFramebuffer`.
