import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "./db/index.js";
import { seedSystemState } from "./db/seed.js";
import { parseEnv } from "./config/env.js";
import { seedAndValidateSettings } from "./config/settings.js";
import { startHealthCron } from "./health/cron.js";

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
  console.log("[boot] Environment validated");

  // 2. Verify DB connection
  const client = await pool.connect();
  client.release();
  console.log("[boot] Database connected");

  // 3. Run migrations (idempotent)
  await migrate(db, {
    migrationsFolder: "./src/web/server/db/migrations",
  });
  console.log("[boot] Migrations applied");

  // 4. Seed system_state
  await seedSystemState();
  console.log("[boot] system_state seeded");

  // 5. Seed & validate app_settings
  await seedAndValidateSettings();
  console.log("[boot] app_settings seeded and validated");

  // 6. Dev-only: point display_base_url at the in-process mock display
  if (process.env.NODE_ENV !== "production") {
    const { getSetting, setSetting } = await import("./config/settings.js");
    const currentUrl = await getSetting("display_base_url");
    const port = Number(process.env.PORT) || 3100;
    const mockUrl = `http://localhost:${port}/mock-display`;
    // Only override if still at the default value (never been customised)
    if (currentUrl === "http://localhost:7000") {
      await setSetting("display_base_url", mockUrl);
      console.log(`[boot] display_base_url set to mock: ${mockUrl}`);
    }
  }

  // 7. Start health-check cron
  await startHealthCron();
  console.log("[boot] Health-check cron started");

  // 8. Reserved for later steps:
  //    - Start node-cron with scheduler_cron
  //    - Register generator_instances crons
  //    - Start HTTP server (handled by caller)
}
