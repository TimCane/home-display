import { db } from "../db/index.js";
import { pushLog } from "../db/schema.js";

export interface PushLogEntry {
  entryId: string;
  succeeded: boolean;
  firmwareStatus?: string | null;
  panelUptimeAfter?: number | null;
  error?: string | null;
  trigger: string;
}

export async function insertPushLog(entry: PushLogEntry): Promise<void> {
  await db.insert(pushLog).values({
    entryId: entry.entryId,
    succeeded: entry.succeeded,
    firmwareStatus: entry.firmwareStatus ?? null,
    panelUptimeAfter: entry.panelUptimeAfter ?? null,
    error: entry.error ?? null,
    trigger: entry.trigger,
  });
}
