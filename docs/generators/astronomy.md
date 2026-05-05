# Generator: Astronomy

Displays daily sun and moon data — sunrise, sunset, golden hour, moon phase, and daylight duration.

## Source

[Open-Meteo](https://open-meteo.com) — free, no API key. Same provider as the weather plugin.

- Endpoint: `GET https://api.open-meteo.com/v1/forecast` with `daily=sunrise,sunset,daylight_duration` and `latitude`/`longitude`.
- Moon phase: calculated locally using a standard lunar phase algorithm (synodic period). No API call needed — the phase is deterministic from the date.

### Data shape

```ts
interface AstronomyData {
  sunrise: string;            // "06:12" (local time)
  sunset: string;             // "20:43"
  daylightMinutes: number;    // e.g. 871
  daylightChange: number;     // minutes gained/lost vs yesterday, signed
  goldenHourStart: string;    // ~1h before sunset
  goldenHourEnd: string;      // sunset time
  moonPhase: {
    name: string;             // "Waxing Crescent", "Full Moon", etc.
    illumination: number;     // 0.0 – 1.0
    emoji: string;            // 🌒🌓🌔🌕🌖🌗🌘🌑 (rendering hint, not displayed as emoji)
    dayOfCycle: number;       // 0-29
  };
  date: string;               // YYYY-MM-DD
}
```

Golden hour is approximated as the 60 minutes before sunset (golden hour start = sunset minus 60 min). Good enough for a household display.

## Config

```ts
z.object({
  location: z.object({
    lat: z.number().min(-90).max(90),
    lon: z.number().min(-180).max(180),
    name: z.string().min(1),
  }),
})
```

Same location shape as the weather plugin. If a user already has weather configured, they use the same lat/lon.

## Renderers

### `today`

A visual layout combining sun arc, moon phase, and key times.

```
┌──────────────────────────────────────────────────┐
│  ██  ASTRONOMY                     London        │  ← black header, location right
├──────────────────────────────────────────────────┤
│                                                  │
│              ╭─── ── ── ── ── ───╮               │
│            ╱  ☀                    ╲              │  ← sun arc (semicircle)
│          ╱     06:12    20:43       ╲             │  ← sunrise / sunset times
│        ──────────────────────────────             │  ← horizon line
│                                                  │
│         14h 31m daylight  (+2m)                  │  ← daylight duration + change
│                                                  │
│   ┌──────────────┐    ┌──────────────────────┐   │
│   │               │    │  Golden Hour          │  │
│   │   ◐           │    │  19:43 – 20:43       │  │  ← moon phase + golden hour
│   │ Waxing Gibous │    │                      │  │
│   │   67%         │    │                      │  │
│   └──────────────┘    └──────────────────────┘   │
│                                                  │
└──────────────────────────────────────────────────┘
```

- **Sun arc**: a semicircle drawn across the upper portion. Sunrise time on the left, sunset on the right. The arc is rendered in yellow with a black outline.
- **Horizon line**: a straight black line beneath the arc.
- **Daylight duration**: centered below the horizon. Change from yesterday shown in parentheses — positive in yellow ("gaining light"), negative in red ("losing light").
- **Moon phase**: bottom-left card. The moon is drawn as a circle with the illuminated portion filled (yellow fill, black for shadow). Phase name and illumination percentage below.
- **Golden hour**: bottom-right card. Start and end times. Simple text layout.
- Background white, black text, yellow and red accents.

## Cron

Default: `0 4 * * *` (daily at 04:00). Runs before sunrise to have fresh data ready.

## Error handling

Standard generator error isolation. Moon phase calculation is local and cannot fail. If Open-Meteo is unreachable, sunrise/sunset/daylight are left at the previous day's values — close enough for a day.

## Notes

- The moon phase is computed, not fetched, using the standard synodic period algorithm. This avoids an extra API dependency and is accurate to within ~1 day — fine for a display.
- The sun arc is decorative, not positionally accurate (it doesn't reflect the sun's actual elevation at the current time). It's a visual device to frame the sunrise/sunset times.
- Daylight change is calculated by fetching yesterday's daylight duration in the same API call (request 2 days of data, compute the delta).
