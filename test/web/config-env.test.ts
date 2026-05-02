import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { parseEnv, resetEnvCache } from "../../src/web/server/config/env.js";

describe("config/env", () => {
  const validEnv = {
    DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
    GITHUB_OAUTH_CLIENT_ID: "test-client-id",
    GITHUB_OAUTH_CLIENT_SECRET: "test-client-secret",
    SESSION_SECRET: "super-secret-key",
    ADMIN_GITHUB_LOGINS: "admin1,admin2",
    APP_BASE_URL: "http://localhost:3100",
  };

  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    // Clear relevant env vars
    for (const key of Object.keys(validEnv)) {
      delete process.env[key];
    }
    resetEnvCache();
  });

  afterEach(() => {
    process.env = originalEnv;
    resetEnvCache();
  });

  it("parses valid env successfully", () => {
    Object.assign(process.env, validEnv);
    const env = parseEnv();
    expect(env.DATABASE_URL).toBe(validEnv.DATABASE_URL);
    expect(env.ADMIN_GITHUB_LOGINS).toBe("admin1,admin2");
  });

  it("throws listing all missing keys when env is incomplete", () => {
    expect(() => parseEnv()).toThrow("Missing or invalid environment variables");
    expect(() => parseEnv()).toThrow("DATABASE_URL");
  });

  it("throws on invalid APP_BASE_URL", () => {
    Object.assign(process.env, { ...validEnv, APP_BASE_URL: "not-a-url" });
    expect(() => parseEnv()).toThrow("APP_BASE_URL");
  });
});
