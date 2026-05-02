import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { resetInFlight } from "../../src/web/server/push/in-flight.js";
import {
  setPollTiming,
  resetPollTiming,
} from "../../src/web/server/push/confirm.js";

// ─── Mock DB ────────────────────────────────────────────────────────────────

const FB_SIZE = 163_200;
const fakeFb = Buffer.alloc(FB_SIZE, 0xaa);
const fakeEntryId = "00000000-0000-0000-0000-000000000001";

const insertedLogs: Array<Record<string, unknown>> = [];

vi.mock("../../src/web/server/db/index.js", () => {
  return {
    db: {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([{ framebuffer: fakeFb }]),
          }),
        }),
      }),
      insert: () => ({
        values: (row: Record<string, unknown>) => {
          insertedLogs.push(row);
          return Promise.resolve();
        },
      }),
    },
  };
});

// ─── Mock settings ──────────────────────────────────────────────────────────

let mockBaseUrl = "";

vi.mock("../../src/web/server/config/settings.js", () => ({
  getSetting: (key: string) => {
    if (key === "display_base_url") return Promise.resolve(mockBaseUrl);
    if (key === "display_token") return Promise.resolve("test-token");
    return Promise.resolve("");
  },
}));

// ─── Fake display server ────────────────────────────────────────────────────

import { serve } from "@hono/node-server";
import { Hono } from "hono";

type FbHandlerFn = () => Response | Promise<Response>;

let mockServer: ReturnType<typeof serve> | null = null;
let fbHandler: FbHandlerFn | undefined;
let statusUptimeS = 0;
let statusCallCount = 0;

function createMockServer(port: number) {
  const app = new Hono();

  app.get("/status", (c) => {
    statusCallCount++;
    return c.json({
      busy: false,
      cooldown_remaining_s: 0,
      last_refresh_uptime_s: statusUptimeS,
      last_refresh_timed_out: false,
      uptime_s: statusUptimeS + 10,
      free_heap: 180_000,
      rssi: -42,
      pending_frame: false,
    });
  });

  app.post("/fb", async () => {
    if (fbHandler) {
      return fbHandler();
    }
    return new Response(JSON.stringify({ status: "accepted" }), {
      headers: { "Content-Type": "application/json" },
    });
  });

  return serve({ fetch: app.fetch, port });
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("push delivery", () => {
  const PORT = 19876;

  beforeEach(() => {
    insertedLogs.length = 0;
    resetInFlight();
    statusUptimeS = 0;
    statusCallCount = 0;
    mockBaseUrl = `http://localhost:${PORT}`;
    fbHandler = undefined;
    // Use fast polling for tests (50ms interval, 3s timeout)
    setPollTiming(50, 3_000);
    mockServer = createMockServer(PORT);
  });

  afterEach(() => {
    resetPollTiming();
    if (mockServer) {
      mockServer.close();
      mockServer = null;
    }
  });

  it("accepted-then-confirmed: pushFrame succeeds with accepted status", async () => {
    let postCount = 0;
    fbHandler = () => {
      postCount++;
      statusUptimeS = 100; // advance uptime after POST
      return new Response(JSON.stringify({ status: "accepted" }), {
        headers: { "Content-Type": "application/json" },
      });
    };

    const { pushFrame } = await import(
      "../../src/web/server/push/push-frame.js"
    );

    const result = await pushFrame({ entryId: fakeEntryId, trigger: "tick" });

    expect(result.ok).toBe(true);
    expect(result.firmwareStatus).toBe("accepted");
    expect(postCount).toBe(1);

    // push_log row inserted
    expect(insertedLogs.length).toBe(1);
    expect(insertedLogs[0].succeeded).toBe(true);
    expect(insertedLogs[0].firmwareStatus).toBe("accepted");
    expect(insertedLogs[0].panelUptimeAfter).toBe(100);
  });

  it("queued: pushFrame succeeds immediately without polling", async () => {
    fbHandler = () => {
      return new Response(JSON.stringify({ status: "queued" }), {
        headers: { "Content-Type": "application/json" },
      });
    };

    const { pushFrame } = await import(
      "../../src/web/server/push/push-frame.js"
    );

    const preStatusCalls = statusCallCount;
    const result = await pushFrame({ entryId: fakeEntryId, trigger: "tick" });

    expect(result.ok).toBe(true);
    expect(result.firmwareStatus).toBe("queued");
    // Should not have polled /status after the POST (only the pre-push check)
    expect(statusCallCount - preStatusCalls).toBeLessThanOrEqual(1);

    expect(insertedLogs.length).toBe(1);
    expect(insertedLogs[0].succeeded).toBe(true);
    expect(insertedLogs[0].firmwareStatus).toBe("queued");
  });

  it("retry-then-success: 503 on first attempt, success on second", async () => {
    let attempt = 0;
    fbHandler = () => {
      attempt++;
      if (attempt === 1) {
        return new Response("Service Unavailable", { status: 503 });
      }
      statusUptimeS = 50;
      return new Response(JSON.stringify({ status: "accepted" }), {
        headers: { "Content-Type": "application/json" },
      });
    };

    const { pushFrame } = await import(
      "../../src/web/server/push/push-frame.js"
    );

    const result = await pushFrame({
      entryId: fakeEntryId,
      trigger: "display_now",
    });

    expect(result.ok).toBe(true);
    expect(attempt).toBe(2);
    expect(insertedLogs.length).toBe(1);
    expect(insertedLogs[0].succeeded).toBe(true);
  }, 15_000);

  it("all-retries-fail: 503 on all attempts logs failure", async () => {
    fbHandler = () => {
      return new Response("Service Unavailable", { status: 503 });
    };

    const { pushFrame } = await import(
      "../../src/web/server/push/push-frame.js"
    );

    const result = await pushFrame({
      entryId: fakeEntryId,
      trigger: "tick",
    });

    expect(result.ok).toBe(false);
    expect(insertedLogs.length).toBe(1);
    expect(insertedLogs[0].succeeded).toBe(false);
  }, 20_000);

  it("in-flight collision: second concurrent call is dropped", async () => {
    // Make the first push slow
    fbHandler = async () => {
      await new Promise((r) => setTimeout(r, 500));
      statusUptimeS = 200;
      return new Response(JSON.stringify({ status: "accepted" }), {
        headers: { "Content-Type": "application/json" },
      });
    };

    const { pushFrame } = await import(
      "../../src/web/server/push/push-frame.js"
    );

    // Launch two concurrent pushes
    const [first, second] = await Promise.all([
      pushFrame({ entryId: fakeEntryId, trigger: "tick" }),
      pushFrame({ entryId: fakeEntryId, trigger: "display_now" }),
    ]);

    // One should succeed, one should be dropped
    const results = [first, second];
    const succeeded = results.filter((r) => r.ok);
    const dropped = results.filter((r) => !r.ok && r.reason === "in-flight");

    expect(succeeded).toHaveLength(1);
    expect(dropped).toHaveLength(1);

    // Should have 2 push_log entries total
    expect(insertedLogs.length).toBe(2);

    const droppedLog = insertedLogs.find(
      (l) => l.firmwareStatus === "dropped"
    );
    expect(droppedLog).toBeDefined();
    expect(droppedLog!.succeeded).toBe(false);
  }, 15_000);

  it("non-retryable error: 400 fails immediately", async () => {
    fbHandler = () => {
      return new Response("Bad Request", { status: 400 });
    };

    const { pushFrame } = await import(
      "../../src/web/server/push/push-frame.js"
    );

    const result = await pushFrame({
      entryId: fakeEntryId,
      trigger: "lock_change",
    });

    expect(result.ok).toBe(false);
    expect(insertedLogs.length).toBe(1);
    expect(insertedLogs[0].succeeded).toBe(false);
    expect(insertedLogs[0].firmwareStatus).toBe("400");
  });
});
