/**
 * Register all built-in generator plugins.
 * Called once during boot, before generator instances are loaded.
 */

import { registerPlugin } from "./registry.js";
import { weatherPlugin } from "./weather/index.js";
import { calendarPlugin } from "./calendar/index.js";
import { holidayWeatherPlugin } from "./holiday-weather/index.js";
import { quotePlugin } from "./quote/index.js";
import { onThisDayPlugin } from "./on-this-day/index.js";
import { wordOfTheDayPlugin } from "./word-of-the-day/index.js";
import { astronomyPlugin } from "./astronomy/index.js";
import { pollenAqiPlugin } from "./pollen-aqi/index.js";
import { binCollectionPlugin } from "./bin-collection/index.js";
import { garminPlugin } from "./garmin/index.js";

export function registerBuiltins(): void {
  registerPlugin(weatherPlugin);
  registerPlugin(calendarPlugin);
  registerPlugin(holidayWeatherPlugin);
  registerPlugin(quotePlugin);
  registerPlugin(onThisDayPlugin);
  registerPlugin(wordOfTheDayPlugin);
  registerPlugin(astronomyPlugin);
  registerPlugin(pollenAqiPlugin);
  registerPlugin(binCollectionPlugin);
  registerPlugin(garminPlugin);
}
