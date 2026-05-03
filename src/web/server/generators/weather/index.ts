/**
 * Weather generator plugin — open-meteo, no API key.
 */

import { z } from "zod";
import type { GeneratorPlugin } from "../types.js";
import { fetchWeather, type WeatherData } from "./fetch.js";
import { renderToday } from "./renderers/today.js";
import { render5Day } from "./renderers/5day.js";
import { loadTimezone } from "../render-utils.js";

const configSchema = z.object({
  location: z.object({
    lat: z.number().min(-90).max(90),
    lon: z.number().min(-180).max(180),
    name: z.string().min(1),
  }),
  units: z.enum(["metric", "imperial"]),
});

type WeatherConfig = z.infer<typeof configSchema>;

export const weatherPlugin: GeneratorPlugin<WeatherConfig> = {
  name: "weather",
  configSchema,

  async fetch(config) {
    const tz = await loadTimezone();
    return fetchWeather(config.location.lat, config.location.lon, config.units, tz);
  },

  renderers: {
    today: (data, config) =>
      renderToday(data as WeatherData, config),
    "5day": (data, config) =>
      render5Day(data as WeatherData, config),
  },
};
