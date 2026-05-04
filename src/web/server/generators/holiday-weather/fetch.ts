/**
 * Fetch weather forecasts for upcoming trips.
 * Uses Open-Meteo (free, no key). Only fetches for trips within the
 * 16-day forecast window; further-out trips get null weather data.
 */

export interface TripConfig {
  name: string;
  location: { lat: number; lon: number; name: string };
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
}

export interface TripForecast {
  name: string;
  locationName: string;
  startDate: string;
  endDate: string;
  daysUntil: number;
  weather: {
    high: number;
    low: number;
    weatherCode: number;
  } | null;
}

export interface HolidayData {
  trips: TripForecast[];
}

interface OpenMeteoDailyResponse {
  daily: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    weather_code: number[];
  };
}

const FORECAST_HORIZON_DAYS = 16;

export async function fetchHolidayWeather(
  trips: TripConfig[],
  units: "metric" | "imperial",
  timezone: string,
): Promise<HolidayData> {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  // Sort by start date, filter out past trips (end date before today)
  const upcoming = trips
    .filter((t) => t.endDate >= todayStr)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .slice(0, 4); // max 4 cards

  const results: TripForecast[] = [];

  for (const trip of upcoming) {
    const startMs = new Date(trip.startDate + "T00:00:00").getTime();
    const daysUntil = Math.max(
      0,
      Math.ceil((startMs - now.getTime()) / (1000 * 60 * 60 * 24)),
    );

    let weather: TripForecast["weather"] = null;

    if (daysUntil <= FORECAST_HORIZON_DAYS) {
      try {
        weather = await fetchLocationForecast(
          trip.location.lat,
          trip.location.lon,
          trip.startDate,
          trip.endDate,
          units,
          timezone,
        );
      } catch {
        // If fetch fails, leave weather as null — we'll show countdown only
      }
    }

    results.push({
      name: trip.name,
      locationName: trip.location.name,
      startDate: trip.startDate,
      endDate: trip.endDate,
      daysUntil,
      weather,
    });
  }

  return { trips: results };
}

async function fetchLocationForecast(
  lat: number,
  lon: number,
  startDate: string,
  endDate: string,
  units: "metric" | "imperial",
  timezone: string,
): Promise<TripForecast["weather"]> {
  const tempUnit = units === "imperial" ? "fahrenheit" : "celsius";
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lon));
  url.searchParams.set("daily", "temperature_2m_max,temperature_2m_min,weather_code");
  url.searchParams.set("temperature_unit", tempUnit);
  url.searchParams.set("timezone", timezone);
  url.searchParams.set("start_date", startDate);
  url.searchParams.set("end_date", endDate);

  const res = await fetch(url.toString(), {
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return null;

  const json = (await res.json()) as OpenMeteoDailyResponse;
  if (!json.daily || json.daily.time.length === 0) return null;

  // Aggregate: overall high, overall low, most common weather code
  const highs = json.daily.temperature_2m_max;
  const lows = json.daily.temperature_2m_min;
  const codes = json.daily.weather_code;

  return {
    high: Math.round(Math.max(...highs)),
    low: Math.round(Math.min(...lows)),
    weatherCode: mostCommon(codes),
  };
}

function mostCommon(arr: number[]): number {
  const counts = new Map<number, number>();
  for (const v of arr) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best = arr[0];
  let bestCount = 0;
  for (const [v, c] of counts) {
    if (c > bestCount) { best = v; bestCount = c; }
  }
  return best;
}
