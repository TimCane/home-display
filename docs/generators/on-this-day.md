# Generator: On This Day

Displays notable historical events that happened on today's date.

## Source

[Wikipedia "On this day" API](https://api.wikimedia.org/wiki/Feed_API/Reference/On_this_day) — free, no API key.

- Endpoint: `GET https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/selected/{MM}/{DD}`
- Returns curated "selected" events (editorially chosen, higher quality than the full list).

### Data shape

```ts
interface OnThisDayData {
  date: { month: number; day: number };
  events: {
    year: number;
    text: string;         // e.g. "The Eiffel Tower is officially opened to the public."
  }[];                    // top 3-4 events, sorted by year ascending
}
```

The fetcher picks up to 4 events from the "selected" list, preferring a spread across different centuries when possible. Events are truncated to fit if the Wikipedia text is too long (some entries are paragraph-length).

## Config

```ts
z.object({
  max_events: z.number().int().min(1).max(5).default(3),
})
```

Almost zero config. `max_events` controls density — 3 is the default for comfortable readability on the display.

## Renderers

### `today`

A timeline-style layout with the date as a prominent header.

```
┌──────────────────────────────────────────────────┐
│  ██  ON THIS DAY                    5 May        │  ← black header, date right-aligned
├──────────────────────────────────────────────────┤
│                                                  │
│   ●  1821                                        │  ← yellow dot + year in bold red
│   │  Napoleon Bonaparte dies in                  │
│   │  exile on Saint Helena.                      │  ← event text, wrapped
│   │                                              │
│   ●  1925                                        │
│   │  John T. Scopes is charged with              │
│   │  teaching evolution, leading to              │
│   │  the Scopes Trial.                           │
│   │                                              │
│   ●  1961                                        │
│   │  Alan Shepard becomes the first              │
│   │  American in space aboard                    │
│   │  Freedom 7.                                  │
│   │                                              │
└──────────────────────────────────────────────────┘
```

- Vertical timeline line in black, running down the left side (80px from left edge).
- Yellow dots at each event node.
- Year rendered in bold red for colour interest.
- Event text in black, wrapping within the right ~75% of the display.
- Events are spaced evenly in the available vertical area.
- If only 1-2 events are returned, they're centred vertically with more breathing room.

## Cron

Default: `0 5 * * *` (daily at 05:00). Content is date-specific — once a day is correct.

## Error handling

Standard generator error isolation. Wikipedia's feed API is highly reliable. On failure, the previous day's frame stays — slightly stale but harmless.

## Notes

- The "selected" endpoint returns editorially curated events, not the raw bulk list. This keeps quality high without needing client-side filtering.
- Event text from Wikipedia can be long. The fetcher truncates each event to 120 characters max, breaking at word boundaries, appending "…" if needed.
- The renderer handles variable event counts gracefully (1-5 events) by adjusting vertical spacing.
