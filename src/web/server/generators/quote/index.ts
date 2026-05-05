import { z } from "zod";
import type { GeneratorPlugin } from "../types.js";
import { fetchQuote, type QuoteData } from "./fetch.js";
import { renderDaily } from "./renderers/daily.js";

const configSchema = z.object({});

type QuoteConfig = z.infer<typeof configSchema>;

export const quotePlugin: GeneratorPlugin<QuoteConfig> = {
  name: "quote",
  configSchema,
  async fetch(_config) {
    return fetchQuote();
  },
  renderers: {
    daily: (data, _config) => renderDaily(data as QuoteData),
  },
};
