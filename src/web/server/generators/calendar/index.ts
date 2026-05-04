/**
 * Calendar generator plugin — ICS feed.
 */

import { z } from "zod";
import type { GeneratorPlugin } from "../types.js";
import { fetchCalendar, type CalendarData } from "./fetch.js";
import { renderTodayTomorrow } from "./renderers/today-tomorrow.js";
import { render5Day } from "./renderers/5day.js";

const configSchema = z.object({
  ics_url: z.string().url(),
  calendar_name: z.string().min(1),
});

type CalendarConfig = z.infer<typeof configSchema>;

export const calendarPlugin: GeneratorPlugin<CalendarConfig> = {
  name: "calendar",
  configSchema,

  async fetch(config) {
    return fetchCalendar(config.ics_url, config.calendar_name);
  },

  renderers: {
    today_tomorrow: (data, config) =>
      renderTodayTomorrow(data as CalendarData, config),
    "5day": (data, config) =>
      render5Day(data as CalendarData, config),
  },
};
