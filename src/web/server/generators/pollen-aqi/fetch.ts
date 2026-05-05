/**
 * Open-Meteo Air Quality API client.
 * Free API, no key needed.  https://open-meteo.com/en/docs/air-quality-api
 */

export interface PollenAqiData {
  aqi: {
    value: number;
    label: string; // "Good", "Fair", "Moderate", "Poor", "Very Poor", "Extremely Poor"
    dominantPollutant: string;
  };
  pollutants: {
    pm25: number;
    pm10: number;
    dust: number;
  };
  pollen: {
    grass: number;
    birch: number;
    alder: number;
    mugwort: number;
    olive: number;
    ragweed: number;
  };
  pollenSummary: {
    dominant: string; // highest pollen type name
    level: string; // "None" | "Low" | "Moderate" | "High" | "Very High"
  };
}

interface OpenMeteoAqiResponse {
  current: {
    european_aqi: number;
    pm10: number;
    pm2_5: number;
    dust: number;
    alder_pollen: number;
    birch_pollen: number;
    grass_pollen: number;
    mugwort_pollen: number;
    olive_pollen: number;
    ragweed_pollen: number;
  };
}

function aqiLabel(value: number): string {
  if (value <= 20) return "Good";
  if (value <= 40) return "Fair";
  if (value <= 60) return "Moderate";
  if (value <= 80) return "Poor";
  if (value <= 100) return "Very Poor";
  return "Extremely Poor";
}

function pollenLevel(value: number): string {
  if (value === 0) return "None";
  if (value <= 10) return "Low";
  if (value <= 50) return "Moderate";
  if (value <= 100) return "High";
  return "Very High";
}

export async function fetchPollenAqi(
  lat: number,
  lon: number,
): Promise<PollenAqiData> {
  const url = new URL(
    "https://air-quality-api.open-meteo.com/v1/air-quality",
  );
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lon));
  url.searchParams.set(
    "current",
    "european_aqi,pm10,pm2_5,dust,alder_pollen,birch_pollen,grass_pollen,mugwort_pollen,olive_pollen,ragweed_pollen",
  );

  const res = await fetch(url.toString(), {
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    throw new Error(
      `open-meteo air-quality returned ${res.status}: ${await res.text()}`,
    );
  }

  const json = (await res.json()) as OpenMeteoAqiResponse;
  const c = json.current;

  // Dominant pollutant: whichever of pm2.5 / pm10 is higher relative to its contribution
  const dominantPollutant = c.pm2_5 >= c.pm10 ? "PM2.5" : "PM10";

  // Pollen readings
  const pollenEntries: { name: string; value: number }[] = [
    { name: "Grass", value: c.grass_pollen },
    { name: "Birch", value: c.birch_pollen },
    { name: "Alder", value: c.alder_pollen },
    { name: "Mugwort", value: c.mugwort_pollen },
    { name: "Olive", value: c.olive_pollen },
    { name: "Ragweed", value: c.ragweed_pollen },
  ];

  // Find dominant pollen
  const sorted = [...pollenEntries].sort((a, b) => b.value - a.value);
  const highestPollen = sorted[0];

  return {
    aqi: {
      value: c.european_aqi,
      label: aqiLabel(c.european_aqi),
      dominantPollutant,
    },
    pollutants: {
      pm25: c.pm2_5,
      pm10: c.pm10,
      dust: c.dust,
    },
    pollen: {
      grass: c.grass_pollen,
      birch: c.birch_pollen,
      alder: c.alder_pollen,
      mugwort: c.mugwort_pollen,
      olive: c.olive_pollen,
      ragweed: c.ragweed_pollen,
    },
    pollenSummary: {
      dominant: highestPollen.value > 0 ? highestPollen.name : "None",
      level: pollenLevel(highestPollen.value),
    },
  };
}
