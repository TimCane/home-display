# Generator: Pollen & Air Quality

Displays the current Air Quality Index, dominant pollutant, and pollen levels.

## Source

[Open-Meteo Air Quality API](https://open-meteo.com/en/docs/air-quality-api) — free, no API key.

- Endpoint: `GET https://air-quality-api.open-meteo.com/v1/air-quality` with `current=european_aqi,pm10,pm2_5,dust,alder_pollen,birch_pollen,grass_pollen,mugwort_pollen,olive_pollen,ragweed_pollen` and `latitude`/`longitude`.
- The European AQI is used by default (0-500 scale). US AQI can be requested via config.

### Data shape

```ts
interface PollenAqiData {
  aqi: {
    value: number;                // 0-500
    label: string;                // "Good", "Fair", "Moderate", "Poor", "Very Poor", "Extremely Poor"
    dominantPollutant: string;    // "PM2.5", "PM10", etc.
  };
  pollutants: {
    pm25: number;       // µg/m³
    pm10: number;       // µg/m³
    dust: number;       // µg/m³
  };
  pollen: {
    grass: number;      // grains/m³
    birch: number;
    alder: number;
    mugwort: number;
    olive: number;
    ragweed: number;
  };
  pollenLevel: {        // derived summary
    dominant: string;   // "Grass", "Birch", etc. — whichever is highest
    level: string;      // "None", "Low", "Moderate", "High", "Very High"
  };
  timestamp: string;
}
```

AQI label thresholds (European AQI):

| Range | Label |
|---|---|
| 0–20 | Good |
| 21–40 | Fair |
| 41–60 | Moderate |
| 61–80 | Poor |
| 81–100 | Very Poor |
| 100+ | Extremely Poor |

Pollen level is derived from the highest individual pollen reading using standard thresholds (varies by pollen type; grass > 50 grains/m³ = "High", for example). The fetcher normalises this into a simple 5-level scale.

## Config

```ts
z.object({
  location: z.object({
    lat: z.number().min(-90).max(90),
    lon: z.number().min(-180).max(180),
    name: z.string().min(1),
  }),
  aqi_standard: z.enum(["european", "us"]).default("european"),
})
```

Same location shape as weather/astronomy.

## Renderers

### `today`

A dashboard layout with AQI as the hero element and pollen as a secondary section.

```
┌──────────────────────────────────────────────────┐
│  ██  AIR QUALITY                   London        │  ← black header, location right
├──────────────────────────────────────────────────┤
│                                                  │
│         ┌────────────────────────┐               │
│         │                        │               │
│         │          23            │               │  ← AQI number, large (60px+)
│         │         GOOD           │               │  ← label, bold
│         │                        │               │
│         └────────────────────────┘               │  ← card border colour = severity
│                                                  │
│      ▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░               │  ← AQI bar (0-100+ scale)
│      Good  Fair  Mod  Poor  V.Poor               │  ← scale labels
│                                                  │
│      PM2.5: 8 µg/m³    PM10: 14 µg/m³           │  ← pollutant readings
│                                                  │
│      ──────────── POLLEN ────────────            │  ← yellow divider + section label
│                                                  │
│      Grass ████████░░  High                      │  ← dominant pollen type + bar
│      Birch ███░░░░░░░  Low                       │  ← secondary pollen
│      Tree  ░░░░░░░░░░  None                      │
│                                                  │
└──────────────────────────────────────────────────┘
```

- **AQI card**: centered, large number. Card border colour reflects severity:
  - Good/Fair: black border (neutral).
  - Moderate: yellow border.
  - Poor and above: red border.
- **AQI bar**: horizontal gauge showing where the reading falls. Filled portion uses yellow (good/fair), red (moderate+).
- **Pollutant readings**: PM2.5 and PM10 as simple text values below the bar.
- **Pollen section**: separated by a yellow divider. Shows up to 3 pollen types (sorted by level, highest first). Each has a small horizontal bar and a level label. Bars use yellow fill for low/moderate, red for high/very high.
- If all pollen readings are zero/none, the pollen section shows "No significant pollen" instead of empty bars.

## Cron

Default: `0 */3 * * *` (every 3 hours). AQI and pollen levels change throughout the day — more frequent than daily generators but not aggressive.

## Error handling

Standard generator error isolation. Open-Meteo's air quality endpoint is reliable. On failure, the previous reading stays.

## Notes

- Pollen data availability is regional. Open-Meteo covers Europe well; other regions may return zeros for all pollen types. The renderer handles this gracefully (shows "No pollen data" if all readings are zero).
- The AQI standard (European vs US) affects the scale and thresholds. The label mapping adjusts accordingly. European is the default since the existing weather plugin was configured for a UK location.
- Pollen types shown are filtered to only those with non-zero readings, up to 3. If more than 3 are active, the top 3 by level are shown.
