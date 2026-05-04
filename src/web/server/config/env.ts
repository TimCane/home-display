import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  GITHUB_OAUTH_CLIENT_ID: z.string().min(1, "GITHUB_OAUTH_CLIENT_ID is required"),
  GITHUB_OAUTH_CLIENT_SECRET: z.string().min(1, "GITHUB_OAUTH_CLIENT_SECRET is required"),
  SESSION_SECRET: z.string().min(1, "SESSION_SECRET is required"),
  ADMIN_GITHUB_LOGINS: z.string().min(1, "ADMIN_GITHUB_LOGINS is required"),
  APP_BASE_URL: z.string().url("APP_BASE_URL must be a valid URL"),
});

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | null = null;

/**
 * Parse and validate required environment variables.
 * Throws a single human-readable error listing all missing/invalid keys.
 */
export function parseEnv(): Env {
  if (cachedEnv) return cachedEnv;

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const missing = result.error.issues.map(
      (issue) => `  - ${issue.path.join(".")}: ${issue.message}`
    );
    throw new Error(
      `Missing or invalid environment variables:\n${missing.join("\n")}`
    );
  }

  cachedEnv = result.data;
  return cachedEnv;
}

/**
 * Get the validated env (throws if parseEnv() hasn't been called).
 */
export function getEnv(): Env {
  if (!cachedEnv) {
    return parseEnv();
  }
  return cachedEnv;
}

/**
 * Reset cached env (for testing only).
 */
export function resetEnvCache(): void {
  cachedEnv = null;
}
