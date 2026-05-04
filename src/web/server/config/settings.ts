import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { appSettings } from "../db/schema.js";
import {
  settingsSchema,
  allSettingsKeys,
  type SettingsKey,
  type SettingValue,
} from "./schema.js";

// In-memory cache
const cache = new Map<string, unknown>();

// Change subscribers
type ChangeListener = (key: SettingsKey, value: unknown) => void;
const listeners: ChangeListener[] = [];

/**
 * Register a callback invoked whenever a setting is written.
 */
export function onSettingChange(fn: ChangeListener): void {
  listeners.push(fn);
}

/**
 * Get a setting value. Uses cache, falls back to DB, inserts default if missing.
 */
export async function getSetting<K extends SettingsKey>(
  key: K
): Promise<SettingValue<K>> {
  if (cache.has(key)) {
    return cache.get(key) as SettingValue<K>;
  }

  const row = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, key))
    .limit(1);

  const def = settingsSchema[key];

  if (row.length === 0) {
    // Insert default
    await db.insert(appSettings).values({
      key,
      value: def.default as unknown as Record<string, unknown>,
    });
    cache.set(key, def.default);
    return def.default as SettingValue<K>;
  }

  const parsed = def.schema.parse(row[0].value);
  cache.set(key, parsed);
  return parsed as SettingValue<K>;
}

/**
 * Write a setting value. Validates, persists, invalidates cache, fires change event.
 */
export async function setSetting<K extends SettingsKey>(
  key: K,
  value: SettingValue<K>
): Promise<void> {
  const def = settingsSchema[key];
  // Validate
  def.schema.parse(value);

  await db
    .insert(appSettings)
    .values({
      key,
      value: value as unknown as Record<string, unknown>,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: {
        value: value as unknown as Record<string, unknown>,
        updatedAt: new Date(),
      },
    });

  cache.set(key, value);

  for (const fn of listeners) {
    fn(key, value);
  }
}

/**
 * Seed all defaults (INSERT if missing) and validate existing values.
 * Called during boot.
 */
export async function seedAndValidateSettings(): Promise<void> {
  for (const key of allSettingsKeys) {
    const row = await db
      .select()
      .from(appSettings)
      .where(eq(appSettings.key, key))
      .limit(1);

    const def = settingsSchema[key];

    if (row.length === 0) {
      await db.insert(appSettings).values({
        key,
        value: def.default as unknown as Record<string, unknown>,
      });
      cache.set(key, def.default);
    } else {
      // Validate — fail fast on schema mismatch
      const result = def.schema.safeParse(row[0].value);
      if (!result.success) {
        throw new Error(
          `app_settings["${key}"] failed validation: ${result.error.message}`
        );
      }
      cache.set(key, result.data);
    }
  }
}

/**
 * Invalidate the entire cache (useful for testing).
 */
export function invalidateCache(): void {
  cache.clear();
}
