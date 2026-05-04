import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, adminProcedure } from "../trpc.js";
import {
  getSetting,
  setSetting,
} from "../../config/settings.js";
import {
  settingsSchema,
  allSettingsKeys,
  type SettingsKey,
} from "../../config/schema.js";

export const settingsRouter = router({
  /** Return every key with its current value. */
  getAll: adminProcedure.query(async () => {
    const result: Record<string, unknown> = {};
    for (const key of allSettingsKeys) {
      result[key] = await getSetting(key);
    }
    return result;
  }),

  /** Validate and persist a single setting. */
  set: adminProcedure
    .input(
      z.object({
        key: z.string(),
        value: z.unknown(),
      }),
    )
    .mutation(async ({ input }) => {
      if (!allSettingsKeys.includes(input.key as SettingsKey)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Unknown setting key: ${input.key}`,
        });
      }

      const key = input.key as SettingsKey;
      const def = settingsSchema[key];

      const result = def.schema.safeParse(input.value);
      if (!result.success) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Invalid value for ${key}: ${result.error.message}`,
        });
      }

      await setSetting(key, result.data as never);
      return { ok: true };
    }),
});
