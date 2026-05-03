/**
 * Open-Meteo forecast client.
 * Free API, no key needed.  https://open-meteo.com/en/docs
 */

export interface WeatherData {
  current: {
    temperature: number;
    weatherCode: number;
  };
  today: {
    high: number;
    low: number;
    weatherCode: number;
  };
  hourly: Array<{ hour: number; temperature: number }>;
  daily: Array<{
    date: string; // YYYY-MM-DD
    high: number;
    low: number;
    weatherCode: number;
  }>;
}

interface OpenMeteoResponse {
  current: {
    temperature_2m: number;
    weather_code: number;
  };
  hourly: {
    time: string[];
    temperature_2m: number[];
  };
  daily: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    weather_code: number[];
  };
}

export async function fetchWeather(
  lat: number,
  lon: number,
  units: "metric" | "imperial",
  timezone: string,
): Promise<WeatherData> {
  const tempUnit = units === "imperial" ? "fahrenheit" : "celsius";
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lon));
  url.searchParams.set("current", "temperature_2m,weather_code");
  url.searchParams.set("hourly", "temperature_2m");
  url.searchParams.set("daily", "temperature_2m_max,temperature_2m_min,weather_code");
  url.searchParams.set("temperature_unit", tempUnit);
  url.searchParams.set("timezone", timezone);
  url.searchParams.set("forecast_days", "5");

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`open-meteo returned ${res.status}: ${await res.text()}`);
  }

  const json = (await res.json()) as OpenMeteoResponse;

  // Current hour index for the hourly slice
  const now = new Date();
  // Get the current hour in the target timezone
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    hour12: false,
  });
  const currentHour = parseInt(formatter.format(now), 10);

  // Extract next 24 hours of hourly data starting from current hour
  const hourly: WeatherData["hourly"] = [];
  for (let i = currentHour; i < Math.min(currentHour + 24, json.hourly.time.length); i++) {
    hourly.push({
      hour: i % 24,
      temperature: json.hourly.temperature_2m[i],
    });
  }

  const daily: WeatherData["daily"] = json.daily.time.map((date, i) => ({
    date,
    high: json.daily.temperature_2m_max[i],
    low: json.daily.temperature_2m_min[i],
    weatherCode: json.daily.weather_code[i],
  }));

  return {
    current: {
      temperature: json.current.temperature_2m,
      weatherCode: json.current.weather_code,
    },
    today: {
      high: daily[0].high,
      low: daily[0].low,
      weatherCode: daily[0].weatherCode,
    },
    hourly,
    daily,
  };
}

/** Map WMO weather code to a human-readable label and simple icon name. */
export function weatherLabel(code: number): { label: string; icon: string } {
  if (code === 0) return { label: "Clear", icon: "sun" };
  if (code <= 3) return { label: "Cloudy", icon: "cloud" };
  if (code <= 49) return { label: "Fog", icon: "cloud" };
  if (code <= 59) return { label: "Drizzle", icon: "rain" };
  if (code <= 69) return { label: "Rain", icon: "rain" };
  if (code <= 79) return { label: "Snow", icon: "snow" };
  if (code <= 82) return { label: "Showers", icon: "rain" };
  if (code <= 86) return { label: "Snow", icon: "snow" };
  if (code <= 99) return { label: "Thunder", icon: "thunder" };
  return { label: "Unknown", icon: "cloud" };
}
