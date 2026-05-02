import { describe, it, expect } from "vitest";
import { settingsSchema, allSettingsKeys } from "../../src/web/server/config/schema.js";

describe("config/schema", () => {
  it("has 8 setting keys", () => {
    expect(allSettingsKeys).toHaveLength(8);
  });

  it("each key has a schema and default that passes validation", () => {
    for (const key of allSettingsKeys) {
      const def = settingsSchema[key];
      expect(def.schema).toBeDefined();
      expect(def.default).toBeDefined();
      // Default should pass its own schema
      const result = def.schema.safeParse(def.default);
      expect(result.success, `Default for "${key}" fails validation`).toBe(true);
    }
  });

  it("palette schema rejects invalid hex", () => {
    const result = settingsSchema.palette.schema.safeParse({
      black: "not-hex",
      white: "#FFFFFF",
      yellow: "#FFEB3B",
      red: "#F44336",
    });
    expect(result.success).toBe(false);
  });

  it("health_check_minutes rejects non-positive", () => {
    expect(settingsSchema.health_check_minutes.schema.safeParse(0).success).toBe(false);
    expect(settingsSchema.health_check_minutes.schema.safeParse(-1).success).toBe(false);
    expect(settingsSchema.health_check_minutes.schema.safeParse(5).success).toBe(true);
  });
});
