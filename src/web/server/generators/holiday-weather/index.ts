/**
 * Holiday weather generator plugin.
 * Shows upcoming trips with forecasts in a card grid.
 */

import { z } from "zod";
import type { GeneratorPlugin } from "../types.js";
import { fetchHolidayWeather, type HolidayData } from "./fetch.js";
import { renderHoliday } from "./render.js";
import { loadTimezone } from "../render-utils.js";

const configSchema = z.object({
  trips: z
    .array(
      z.object({
        name: z.string().min(1),
        location: z.object({
          lat: z.number().min(-90).max(90),
          lon: z.number().min(-180).max(180),
          name: z.string().min(1),
        }),
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      }),
    )
    .min(1)
    .max(8),
  units: z.enum(["metric", "imperial"]),
});

type HolidayConfig = z.infer<typeof configSchema>;

export const holidayWeatherPlugin: GeneratorPlugin<HolidayConfig> = {
  name: "holiday-weather",
  configSchema,

  async fetch(config) {
    const tz = await loadTimezone();
    return fetchHolidayWeather(config.trips, config.units, tz);
  },

  renderers: {
    cards: (data, config) => renderHoliday(data as HolidayData, config),
  },
};
