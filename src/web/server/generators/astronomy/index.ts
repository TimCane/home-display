/**
 * Astronomy generator plugin — sunrise/sunset, moon phase, golden hour.
 */

import { z } from "zod";
import type { GeneratorPlugin } from "../types.js";
import { fetchAstronomy, type AstronomyData } from "./fetch.js";
import { renderToday } from "./renderers/today.js";
import { loadTimezone } from "../render-utils.js";

const configSchema = z.object({
  location: z.object({
    lat: z.number().min(-90).max(90),
    lon: z.number().min(-180).max(180),
    name: z.string().min(1),
  }),
});

type AstronomyConfig = z.infer<typeof configSchema>;

export const astronomyPlugin: GeneratorPlugin<AstronomyConfig> = {
  name: "astronomy",
  configSchema,

  async fetch(config) {
    const tz = await loadTimezone();
    return fetchAstronomy(config.location.lat, config.location.lon, tz);
  },

  renderers: {
    today: (data, config) => renderToday(data as AstronomyData, config),
  },
};
