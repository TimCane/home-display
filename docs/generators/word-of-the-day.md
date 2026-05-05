# Generator: Word of the Day

Displays a word, its definition, pronunciation, and part of speech — a daily vocabulary card on the display.

## Source

[Free Dictionary API](https://dictionaryapi.dev/) — free, no API key.

- Endpoint: `GET https://api.dictionaryapi.dev/api/v2/entries/en/{word}`
- Word selection: the fetcher picks from a curated list of ~1,000 interesting/uncommon English words bundled as a static JSON file in the plugin directory. The word is selected deterministically by day (`day-of-year + year` as seed) so every instance shows the same word on the same day, and it doesn't repeat within a year.

### Data shape

```ts
interface WordData {
  word: string;
  phonetic: string | null;        // e.g. "/ˈsɛr.ən.dɪp.ɪ.ti/"
  partOfSpeech: string;           // e.g. "noun"
  definition: string;             // primary definition
  example: string | null;         // usage example, if available
}
```

## Config

```ts
z.object({
  // No required config.
})
```

Zero-config. The word list and API are built in.

## Renderers

### `daily`

A dictionary-card layout.

```
┌──────────────────────────────────────────────────┐
│  ██  WORD OF THE DAY                             │  ← black header bar, yellow accent
├──────────────────────────────────────────────────┤
│                                                  │
│                                                  │
│         serendipity                              │  ← word, large bold (40px+)
│         /ˌsɛr.ən.ˈdɪp.ɪ.ti/                    │  ← phonetic, smaller, red
│                                                  │
│         noun                                     │  ← part of speech, italic
│                                                  │
│         ─────────────────                        │  ← yellow divider
│                                                  │
│         The occurrence of events by               │
│         chance in a happy or beneficial           │  ← definition, wrapped text
│         way.                                     │
│                                                  │
│         "A fortunate stroke of                   │
│          serendipity."                           │  ← example in quotes, italic, if present
│                                                  │
└──────────────────────────────────────────────────┘
```

- Word is left-aligned with 60px left margin, vertically centered in the available space.
- Phonetic in red to add colour interest.
- Yellow divider between metadata and definition.
- Definition wraps with proper word-breaking. Max ~4 lines at the chosen font size.
- Example sentence, if available, rendered in italic below the definition.
- If the API returns no data for a word, the fetcher tries the next word in the list.

## Cron

Default: `0 5 * * *` (daily at 05:00).

## Error handling

Standard generator error isolation. If the dictionary API is unreachable, the previous word stays. If a word has no API entry, the fetcher advances to the next word in the list and retries (up to 3 attempts).

## Notes

- The curated word list avoids obscure/archaic words that would be uninteresting. It favours words that are uncommon but recognisable — the kind you'd see in a broadsheet crossword.
- Deterministic selection means all instances show the same word. This is intentional — it's "word of the day", not "word of the instance".
