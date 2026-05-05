/**
 * Pollen & Air Quality generator plugin — open-meteo, no API key.
 */

import { z } from "zod";
import type { GeneratorPlugin } from "../types.js";
import { fetchPollenAqi, type PollenAqiData } from "./fetch.js";
import { renderToday } from "./renderers/today.js";

const configSchema = z.object({
  location: z.object({
    lat: z.number().min(-90).max(90),
    lon: z.number().min(-180).max(180),
    name: z.string().min(1),
  }),
});

type PollenAqiConfig = z.infer<typeof configSchema>;

export const pollenAqiPlugin: GeneratorPlugin<PollenAqiConfig> = {
  name: "pollen-aqi",
  configSchema,

  async fetch(config) {
    return fetchPollenAqi(config.location.lat, config.location.lon);
  },

  renderers: {
    today: (data, config) => renderToday(data as PollenAqiData, config),
  },
};
