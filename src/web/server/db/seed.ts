import { db } from "./index.js";
import { systemState } from "./schema.js";
import { sql } from "drizzle-orm";

/**
 * Ensure the singleton system_state row exists (idempotent).
 */
export async function seedSystemState(): Promise<void> {
  await db
    .insert(systemState)
    .values({ id: 1 })
    .onConflictDoNothing();
}
