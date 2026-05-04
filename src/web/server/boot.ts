import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "./db/index.js";
import { seedSystemState } from "./db/seed.js";
import { parseEnv } from "./config/env.js";
import { seedAndValidateSettings } from "./config/settings.js";
import { startHealthCron } from "./health/cron.js";
import { startSchedulerCron } from "./scheduler/cron.js";
import { bootInstances } from "./generators/runtime.js";
import { registerBuiltins } from "./generators/index.js";
import { logger } from "./logger.js";

/**
 * Full startup sequence:
 * 1. Parse env (fail-fast)
 * 2. Connect to DB (verify connection)
 * 3. Run Drizzle migrations
 * 4. Seed system_state singleton
 * 5. Seed & validate app_settings
 * 6. (Cron scheduler + generator instances + HTTP server start in later steps)
 */
export async function boot(): Promise<void> {
  // 1. Parse and validate env vars
  const env = parseEnv();
  logger.info("Environment validated");

  // 2. Verify DB connection
  const client = await pool.connect();
  client.release();
  logger.info("Database connected");

  // 3. Run migrations (idempotent)
  await migrate(db, {
    migrationsFolder: "./src/web/server/db/migrations",
  });
  logger.info("Migrations applied");

  // 4. Seed system_state
  await seedSystemState();
  logger.info("system_state seeded");

  // 5. Seed & validate app_settings
  await seedAndValidateSettings();
  logger.info("app_settings seeded and validated");

  // 6. Dev-only: point display_base_url at the in-process mock display
  if (process.env.NODE_ENV !== "production") {
    const { getSetting, setSetting } = await import("./config/settings.js");
    const currentUrl = await getSetting("display_base_url");
    const port = Number(process.env.PORT) || 3100;
    const mockUrl = `http://localhost:${port}/mock-display`;
    // Only override if still at the default value (never been customised)
    if (currentUrl === "http://localhost:7000") {
      await setSetting("display_base_url", mockUrl);
      logger.info({ mockUrl }, "display_base_url set to mock");
    }
  }

  // 7. Start health-check cron
  await startHealthCron();
  logger.info("Health-check cron started");

  // 8. Start scheduler cron (tick + auto-disable sweep)
  await startSchedulerCron();
  logger.info("Scheduler cron started");

  // 9. Register built-in generator plugins
  registerBuiltins();
  logger.info("Built-in generator plugins registered");

  // 10. Load generator instances and register their crons
  await bootInstances();
  logger.info("Generator instance crons started");
}
