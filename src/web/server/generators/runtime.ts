/**
 * Per-instance cron management and run executor.
 *
 * Each generator instance gets its own node-cron task. On each tick the
 * plugin's fetcher and renderer run inside a try/catch so one broken
 * plugin can never crash the process or affect other instances.
 */

import * as cron from "node-cron";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { entries, generatorInstances, generatorRuns } from "../db/schema.js";
import { getPlugin } from "./registry.js";
import { FRAME_BYTES } from "../../shared/framebuffer.js";
import { logger } from "../logger.js";

/** Active cron tasks keyed by instance id. */
const tasks = new Map<string, cron.ScheduledTask>();

/** Execute a single generator run: fetch → render → persist. */
async function executeRun(instanceId: string): Promise<void> {
  const [instance] = await db
    .select()
    .from(generatorInstances)
    .where(eq(generatorInstances.id, instanceId));

  if (!instance) {
    logger.warn({ instanceId }, "Instance not found, skipping run");
    return;
  }

  const plugin = getPlugin(instance.pluginName);
  if (!plugin) {
    await logRun(instanceId, false, `Plugin "${instance.pluginName}" not registered`);
    return;
  }

  try {
    // Validate config against plugin schema
    const config = plugin.configSchema.parse(instance.config);

    // Fetch external data
    const data = await plugin.fetch(config);

    // Render framebuffer
    const rendererFn = plugin.renderers[instance.renderer];
    if (!rendererFn) {
      await logRun(instanceId, false, `Renderer "${instance.renderer}" not found on plugin "${instance.pluginName}"`);
      return;
    }

    const framebuffer = await rendererFn(data, config);

    // Validate size
    if (framebuffer.length !== FRAME_BYTES) {
      await logRun(
        instanceId,
        false,
        `Renderer returned ${framebuffer.length} bytes, expected ${FRAME_BYTES}`,
      );
      return;
    }

    // Persist framebuffer into the owned entry (bumps updated_at)
    await db
      .update(entries)
      .set({
        framebuffer: Buffer.from(framebuffer),
        updatedAt: new Date(),
      })
      .where(eq(entries.id, instance.entryId));

    await logRun(instanceId, true);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ instanceId, error: message }, "Run failed");
    await logRun(instanceId, false, message);
  }
}

async function logRun(
  instanceId: string,
  succeeded: boolean,
  error?: string,
): Promise<void> {
  await db.insert(generatorRuns).values({
    instanceId,
    succeeded,
    error: error ?? null,
  });
}

/** Register a cron task for an instance. Stops any existing task for the same id. */
export function registerInstance(instance: {
  id: string;
  cronExpr: string;
}): void {
  unregisterInstance(instance.id);

  const task = cron.schedule(instance.cronExpr, () => {
    executeRun(instance.id).catch((err) => {
      logger.error({ instanceId: instance.id, err }, "Unhandled error in instance");
    });
  });

  tasks.set(instance.id, task);
  logger.info({ instanceId: instance.id, cronExpr: instance.cronExpr }, "Instance cron registered");
}

/** Stop and remove the cron task for an instance. */
export function unregisterInstance(id: string): void {
  const existing = tasks.get(id);
  if (existing) {
    existing.stop();
    tasks.delete(id);
  }
}

/** Re-register: convenience for update flows where cron_expr may have changed. */
export function reregisterInstance(instance: {
  id: string;
  cronExpr: string;
}): void {
  registerInstance(instance);
}

/** Trigger an immediate run outside the cron schedule. */
export async function runNow(instanceId: string): Promise<void> {
  await executeRun(instanceId);
}

/** Load all instances from the DB and register their crons. Called at boot. */
export async function bootInstances(): Promise<void> {
  const rows = await db.select().from(generatorInstances);

  for (const row of rows) {
    registerInstance({ id: row.id, cronExpr: row.cronExpr });
  }

  logger.info({ count: rows.length }, "Generator instances loaded at boot");
}

/** Stop all active crons. */
export function stopAll(): void {
  for (const [id, task] of tasks) {
    task.stop();
  }
  tasks.clear();
}
