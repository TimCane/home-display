/**
 * Astronomy data fetcher.
 * Sunrise/sunset from Open-Meteo; moon phase calculated locally.
 */

export interface AstronomyData {
  sunrise: string;          // "06:12"
  sunset: string;           // "20:43"
  daylightMinutes: number;
  daylightChange: number;   // vs yesterday, signed (minutes)
  goldenHourStart: string;  // sunset minus 60 min
  goldenHourEnd: string;    // = sunset
  moonPhase: {
    name: string;
    illumination: number;   // 0.0–1.0
    dayOfCycle: number;     // 0–29
  };
  date: string;
}

/* ── Moon phase helpers ─────────────────────────────────────────── */

const SYNODIC_PERIOD = 29.53058770576;
const NEW_MOON_JD = 2451550.1; // Jan 6, 2000

function toJulianDate(d: Date): number {
  return d.getTime() / 86_400_000 + 2440587.5;
}

function moonPhase(date: Date): AstronomyData["moonPhase"] {
  const jd = toJulianDate(date);
  const dayOfCycle = ((jd - NEW_MOON_JD) % SYNODIC_PERIOD + SYNODIC_PERIOD) % SYNODIC_PERIOD;
  const illumination = (1 - Math.cos((2 * Math.PI * dayOfCycle) / SYNODIC_PERIOD)) / 2;

  let name: string;
  if (dayOfCycle < 1.85) name = "New Moon";
  else if (dayOfCycle < 7.38) name = "Waxing Crescent";
  else if (dayOfCycle < 11.07) name = "First Quarter";
  else if (dayOfCycle < 14.77) name = "Waxing Gibbous";
  else if (dayOfCycle < 18.46) name = "Full Moon";
  else if (dayOfCycle < 22.15) name = "Waning Gibbous";
  else if (dayOfCycle < 25.84) name = "Last Quarter";
  else name = "Waning Crescent";

  return { name, illumination, dayOfCycle };
}

/* ── Time helpers ───────────────────────────────────────────────── */

/** Extract "HH:MM" from an ISO-8601 datetime string. */
function extractHHMM(iso: string): string {
  // Open-Meteo returns e.g. "2025-06-01T06:12"
  const timePart = iso.includes("T") ? iso.split("T")[1] : iso;
  return timePart.slice(0, 5);
}

/** Subtract `minutes` from an "HH:MM" string and return a new "HH:MM". */
function subtractMinutes(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const total = h * 60 + m - minutes;
  const adjTotal = ((total % 1440) + 1440) % 1440;
  const hh = String(Math.floor(adjTotal / 60)).padStart(2, "0");
  const mm = String(adjTotal % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

/* ── Open-Meteo response shape ──────────────────────────────────── */

interface OpenMeteoSunResponse {
  daily: {
    time: string[];
    sunrise: string[];
    sunset: string[];
    daylight_duration: number[];
  };
}

/* ── Public fetch ───────────────────────────────────────────────── */

export async function fetchAstronomy(
  lat: number,
  lon: number,
  timezone: string,
): Promise<AstronomyData> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lon));
  url.searchParams.set("daily", "sunrise,sunset,daylight_duration");
  url.searchParams.set("timezone", timezone);
  url.searchParams.set("past_days", "1");
  url.searchParams.set("forecast_days", "1");

  const res = await fetch(url.toString(), {
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    throw new Error(`open-meteo returned ${res.status}: ${await res.text()}`);
  }

  const json = (await res.json()) as OpenMeteoSunResponse;
  const d = json.daily;

  // Index 0 = yesterday, index 1 = today
  const sunrise = extractHHMM(d.sunrise[1]);
  const sunset = extractHHMM(d.sunset[1]);
  const daylightSeconds = d.daylight_duration[1]; // seconds
  const daylightMinutes = Math.round(daylightSeconds / 60);
  const yesterdayMinutes = Math.round(d.daylight_duration[0] / 60);
  const daylightChange = daylightMinutes - yesterdayMinutes;

  const goldenHourEnd = sunset;
  const goldenHourStart = subtractMinutes(sunset, 60);

  const now = new Date();
  const dateStr = now.toLocaleDateString("en-CA", { timeZone: timezone }); // YYYY-MM-DD

  return {
    sunrise,
    sunset,
    daylightMinutes,
    daylightChange,
    goldenHourStart,
    goldenHourEnd,
    moonPhase: moonPhase(now),
    date: dateStr,
  };
}
