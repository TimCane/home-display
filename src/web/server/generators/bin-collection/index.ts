/**
 * Bin collection generator plugin.
 */

import { z } from "zod";
import type { GeneratorPlugin } from "../types.js";
import { fetchBinCollection, type BinCollectionData } from "./fetch.js";
import { renderNext } from "./renderers/next.js";
import { renderWeek } from "./renderers/week.js";

const configSchema = z
  .object({
    source_type: z.enum(["ics", "json", "woking"]),
    ics_url: z.string().url().optional(),
    api_url: z.string().url().optional(),
    address_id: z.string().optional(),
    council_name: z.string().min(1),
    postcode: z.string().optional(),
    house_number: z.string().optional(),
  })
  .refine(
    (d) => {
      if (d.source_type === "ics") return !!d.ics_url;
      if (d.source_type === "json") return !!d.api_url;
      if (d.source_type === "woking") return !!d.postcode && !!d.house_number;
      return false;
    },
    { message: "ICS requires ics_url; JSON requires api_url; Woking requires postcode + house_number" },
  );

type BinCollectionConfig = z.infer<typeof configSchema>;

export const binCollectionPlugin: GeneratorPlugin<BinCollectionConfig> = {
  name: "bin-collection",
  configSchema,

  async fetch(config) {
    return fetchBinCollection(config);
  },

  renderers: {
    next: (data, config) =>
      renderNext(data as BinCollectionData, config),
    week: (data, config) =>
      renderWeek(data as BinCollectionData, config),
  },
};
