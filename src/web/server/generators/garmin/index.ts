/**
 * Garmin generator plugin — daily health stats and recent activities.
 *
 * Credentials (username/password) are stored as shared plugin config,
 * so they only need to be entered once for all Garmin instances.
 */

import { z } from "zod";
import type { GeneratorPlugin } from "../types.js";
import { fetchGarmin, type GarminData } from "./fetch.js";
import { renderSummary } from "./renderers/summary.js";
import { renderActivity } from "./renderers/activity.js";
import { renderSleep } from "./renderers/sleep.js";
import { renderWeekly } from "./renderers/weekly.js";
import { renderHealth } from "./renderers/health.js";
import { renderWeight } from "./renderers/weight.js";

const sharedConfigSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

const configSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

type GarminConfig = z.infer<typeof configSchema>;

export const garminPlugin: GeneratorPlugin<GarminConfig> = {
  name: "garmin",
  sharedConfigSchema,
  configSchema,

  async fetch(config) {
    return fetchGarmin(config);
  },

  renderers: {
    summary: (data, _config) => renderSummary(data as GarminData),
    activity: (data, _config) => renderActivity(data as GarminData),
    sleep: (data, _config) => renderSleep(data as GarminData),
    weekly: (data, _config) => renderWeekly(data as GarminData),
    health: (data, _config) => renderHealth(data as GarminData),
    weight: (data, _config) => renderWeight(data as GarminData),
  },
};
