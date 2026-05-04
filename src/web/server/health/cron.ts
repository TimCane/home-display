import * as cron from "node-cron";
import { getSetting, onSettingChange } from "../config/settings.js";
import { poll, pruneStatusHistory } from "./poll.js";
import { logger } from "../logger.js";

let task: cron.ScheduledTask | null = null;
let pruneTask: cron.ScheduledTask | null = null;

function cronExpr(minutes: number): string {
  return `*/${minutes} * * * *`;
}

/**
 * Start the health-check cron job. Re-registers when
 * `health_check_minutes` changes.
 */
export async function startHealthCron(): Promise<void> {
  const minutes = await getSetting("health_check_minutes");
  register(minutes);

  onSettingChange((key, value) => {
    if (key === "health_check_minutes") {
      register(value as number);
    }
  });

  // Daily prune of status history rows older than 90 days (runs at 03:00)
  pruneTask = cron.schedule("0 3 * * *", () => {
    pruneStatusHistory().catch((err) => {
      logger.error({ err }, "Status history prune error");
    });
  });

  logger.info({ expr: "0 3 * * *" }, "Status history prune cron registered");
}

function register(minutes: number): void {
  if (task) {
    task.stop();
    task = null;
  }

  const expr = cronExpr(minutes);
  task = cron.schedule(expr, () => {
    poll().catch((err) => {
      logger.error({ err }, "Poll error");
    });
  });

  logger.info({ expr }, "Health cron registered");
}

/**
 * Stop the health cron (for testing / shutdown).
 */
export function stopHealthCron(): void {
  if (task) {
    task.stop();
    task = null;
  }
  if (pruneTask) {
    pruneTask.stop();
    pruneTask = null;
  }
}
