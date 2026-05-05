/**
 * "On This Day" generator plugin — Wikipedia selected events.
 */

import { z } from "zod";
import type { GeneratorPlugin } from "../types.js";
import { fetchOnThisDay, type OnThisDayData } from "./fetch.js";
import { renderToday } from "./renderers/today.js";
import { loadTimezone } from "../render-utils.js";

const configSchema = z.object({
  max_events: z.number().int().min(1).max(5).default(3),
});

type OnThisDayConfig = z.infer<typeof configSchema>;

export const onThisDayPlugin: GeneratorPlugin<OnThisDayConfig> = {
  name: "on-this-day",
  configSchema,

  async fetch(config) {
    const tz = await loadTimezone();
    return fetchOnThisDay(config.max_events, tz);
  },

  renderers: {
    today: (data) => renderToday(data as OnThisDayData),
  },
};
