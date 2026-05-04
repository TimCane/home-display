/**
 * Register the scheduler tick cron and the auto-disable sweep cron.
 *
 * The tick cron expression comes from app_settings.scheduler_cron and
 * is re-registered whenever that setting changes.
 *
 * The auto-disable sweep runs on a fixed 10-minute cadence.
 */

import * as cron from "node-cron";
import { getSetting, onSettingChange } from "../config/settings.js";
import { tick } from "./tick.js";
import { autoDisableSweep } from "./auto-disable.js";
import { logger } from "../logger.js";

let tickTask: cron.ScheduledTask | null = null;
let sweepTask: cron.ScheduledTask | null = null;

function registerTick(expr: string): void {
  if (tickTask) {
    tickTask.stop();
    tickTask = null;
  }

  tickTask = cron.schedule(expr, () => {
    tick().catch((err) => {
      logger.error({ err }, "Tick error");
    });
  });

  logger.info({ expr }, "Tick cron registered");
}

export async function startSchedulerCron(): Promise<void> {
  // Register tick cron from settings
  const expr = await getSetting("scheduler_cron");
  registerTick(expr);

  // Re-register when scheduler_cron changes
  onSettingChange((key, value) => {
    if (key === "scheduler_cron") {
      registerTick(value as string);
    }
  });

  // Register auto-disable sweep: fixed every 10 minutes
  sweepTask = cron.schedule("*/10 * * * *", () => {
    autoDisableSweep().catch((err) => {
      logger.error({ err }, "Auto-disable sweep error");
    });
  });

  logger.info({ expr: "*/10 * * * *" }, "Auto-disable sweep cron registered");
}

export function stopSchedulerCron(): void {
  if (tickTask) {
    tickTask.stop();
    tickTask = null;
  }
  if (sweepTask) {
    sweepTask.stop();
    sweepTask = null;
  }
}
