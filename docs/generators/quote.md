# Generator: Quote of the Day

Displays an inspiring or thought-provoking quote, centered on the display.

## Source

[ZenQuotes API](https://zenquotes.io/api) — free, no API key, returns a random quote per call.

- Endpoint: `GET https://zenquotes.io/api/today` (returns the same quote for the whole day).
- Fallback: `GET https://zenquotes.io/api/random` if the "today" endpoint is down.

### Data shape

```ts
interface QuoteData {
  text: string;    // The quote body
  author: string;  // Attribution
}
```

## Config

```ts
z.object({
  // No required config — the plugin works out of the box.
  // Optional overrides for future flexibility:
  category: z.string().optional(),  // reserved for future filtering
})
```

Minimal config. The point is zero friction — create an instance and it works.

## Renderers

### `daily`

A clean, typographic layout that lets the quote breathe.

```
┌──────────────────────────────────────────────────┐
│                                                  │
│                                                  │
│                                                  │
│        "The only way to do great work             │
│         is to love what you do."                  │  ← quote text, large serif-style
│                                                  │
│                                                  │
│              ────────────                         │  ← yellow accent divider
│                                                  │
│              — Steve Jobs                         │  ← author, smaller, right-aligned
│                                                  │
│                                                  │
│                                                  │
└──────────────────────────────────────────────────┘
```

- Quote text is centered vertically and horizontally, with generous margins (80px sides).
- Font size adapts to quote length: short quotes (< 80 chars) get ~36px bold, medium (80-200) get ~28px, long (200+) get ~22px.
- Opening/closing quotation marks rendered as large decorative glyphs in yellow.
- Author name below a short yellow divider line, right-aligned.
- Background: white. Text: black. Accents: yellow.
- If the quote is too long to fit even at minimum size, it's truncated with "…" (this shouldn't happen with ZenQuotes, which returns short-to-medium quotes).

## Cron

Default: `0 5 * * *` (daily at 05:00). One quote per day is the intended cadence.

## Error handling

Standard generator error isolation. If ZenQuotes is unreachable, the previous day's quote stays on display — perfectly acceptable since it's a daily rotation anyway.

## Notes

- No user-supplied quotes — this is a fetcher-based generator, not a text entry tool. The editor already handles custom text/images.
- The renderer doesn't cache quotes in the DB beyond what the framebuffer stores. The fetcher is stateless.
