import { z } from "zod";
import { eq } from "drizzle-orm";
import { router, adminProcedure } from "../trpc.js";
import { db } from "../../db/index.js";
import { systemState } from "../../db/schema.js";
import { setLock, clearLock } from "../../scheduler/lock.js";
import { emitSystemEvent } from "../../events.js";
import { pushFrame } from "../../push/push-frame.js";
import { encode2bpp, WIDTH, HEIGHT, TOTAL_PIXELS, FRAME_BYTES } from "../../../shared/framebuffer.js";

export const systemRouter = router({
  /** Current system_state row. */
  getState: adminProcedure.query(async () => {
    const [state] = await db
      .select()
      .from(systemState)
      .where(eq(systemState.id, 1));
    return state;
  }),

  /** Pin display to an entry. */
  lock: adminProcedure
    .input(z.object({ entryId: z.string().uuid() }))
    .mutation(async ({ input }) => {
      await setLock(input.entryId);
      return { ok: true };
    }),

  /** Remove display lock. */
  unlock: adminProcedure.mutation(async () => {
    await clearLock();
    return { ok: true };
  }),

  /** Set a manual flag on system_state.flags. */
  setFlag: adminProcedure
    .input(z.object({ name: z.string().min(1), value: z.boolean() }))
    .mutation(async ({ input }) => {
      const [state] = await db
        .select({ flags: systemState.flags })
        .from(systemState)
        .where(eq(systemState.id, 1));

      const flags = { ...(state.flags as Record<string, boolean>) };
      flags[input.name] = input.value;

      await db
        .update(systemState)
        .set({ flags })
        .where(eq(systemState.id, 1));

      emitSystemEvent({
        type: "flag_change",
        payload: { flag: input.name, value: input.value },
      });

      return { ok: true };
    }),

  /** Generate a 4-quadrant test pattern and push it (no entries row). */
  pushTestPattern: adminProcedure.mutation(async () => {
    // Build test pattern: 4 quadrants, each a different palette index
    const indices = new Uint8Array(TOTAL_PIXELS);
    const halfW = WIDTH / 2;
    const halfH = HEIGHT / 2;

    for (let y = 0; y < HEIGHT; y++) {
      for (let x = 0; x < WIDTH; x++) {
        const quadrant =
          y < halfH ? (x < halfW ? 0 : 1) : x < halfW ? 2 : 3;
        indices[y * WIDTH + x] = quadrant;
      }
    }

    const framebuffer = Buffer.from(encode2bpp(indices));

    // Push directly to display without creating an entry
    const { getSetting } = await import("../../config/settings.js");
    const baseUrl = await getSetting("display_base_url");
    const token = await getSetting("display_token");

    const res = await fetch(`${baseUrl}/fb`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/octet-stream",
        "Content-Length": String(FRAME_BYTES),
      },
      body: new Uint8Array(framebuffer),
    });

    const ok = res.ok;
    return { ok };
  }),
});
