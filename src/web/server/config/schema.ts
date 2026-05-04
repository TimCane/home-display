import { z } from "zod";
import * as cron from "node-cron";

/**
 * Zod schema and default value for each app_settings key.
 */

const paletteSchema = z.object({
  black: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  white: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  yellow: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  red: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

export const settingsSchema = {
  palette: {
    schema: paletteSchema,
    default: {
      black: "#000000",
      white: "#FFFFFF",
      yellow: "#FFEB3B",
      red: "#F44336",
    },
  },
  scheduler_cron: {
    schema: z.string().min(1).refine((v) => cron.validate(v), {
      message: "Invalid cron expression",
    }),
    default: "*/30 * * * *",
  },
  app_tz: {
    schema: z.string().min(1),
    default: "Europe/London",
  },
  health_check_minutes: {
    schema: z.number().int().positive(),
    default: 5,
  },
  first_view_boost: {
    schema: z.number().int().min(0),
    default: 10,
  },
  decay_half_life_hours: {
    schema: z.number().int().positive(),
    default: 12,
  },
  display_base_url: {
    schema: z.string().min(1),
    default: "http://localhost:7000",
  },
  display_token: {
    schema: z.string().min(1),
    default: "dev-token",
  },
} as const;

export type SettingsKey = keyof typeof settingsSchema;

export type SettingValue<K extends SettingsKey> = z.infer<
  (typeof settingsSchema)[K]["schema"]
>;

export const allSettingsKeys = Object.keys(settingsSchema) as SettingsKey[];
