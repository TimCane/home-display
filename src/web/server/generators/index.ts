/**
 * Register all built-in generator plugins.
 * Called once during boot, before generator instances are loaded.
 */

import { registerPlugin } from "./registry.js";
import { weatherPlugin } from "./weather/index.js";
import { calendarPlugin } from "./calendar/index.js";
import { holidayWeatherPlugin } from "./holiday-weather/index.js";

export function registerBuiltins(): void {
  registerPlugin(weatherPlugin);
  registerPlugin(calendarPlugin);
  registerPlugin(holidayWeatherPlugin);
}
