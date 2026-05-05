/**
 * Word of the Day generator plugin — zero-config.
 */

import { z } from "zod";
import type { GeneratorPlugin } from "../types.js";
import { fetchWord, type WordData } from "./fetch.js";
import { renderDaily } from "./renderers/daily.js";

const configSchema = z.object({});

type WordConfig = z.infer<typeof configSchema>;

export const wordOfTheDayPlugin: GeneratorPlugin<WordConfig> = {
  name: "word-of-the-day",
  configSchema,

  async fetch() {
    return fetchWord();
  },

  renderers: {
    daily: (data) => renderDaily(data as WordData),
  },
};
