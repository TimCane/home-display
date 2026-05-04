/**
 * Integration tests for entry CRUD via tRPC router callers.
 *
 * The entry router reads from ctx.db (passed via tRPC context), so we build
 * a fake drizzle-like db object and inject it directly.  No real Postgres
 * connection is needed.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { FRAME_BYTES } from "../../src/web/shared/framebuffer.js";

// ─── Valid UUID generator ───────────────────────────────────────────────────

let idSeq = 0;

function fakeUuid() {
  idSeq++;
  // RFC 4122 v4 variant-1 UUID
  const hex = String(idSeq).padStart(12, "0");
  return `00000000-0000-4000-a000-${hex}`;
}

const MISSING_UUID = "11111111-1111-4111-a111-111111111111";

// ─── In-memory store ────────────────────────────────────────────────────────

interface FakeEntry {
  id: string;
  source: string;
  title: string;
  submitterName: string | null;
  framebuffer: Buffer;
  createdAt: Date;
  updatedAt: Date;
  enabled: boolean;
  baseWeight: number;
  conditions: unknown[];
  lastShownAt: Date | null;
  showCount: number;
}

interface FakeGenInstance {
  id: string;
  entryId: string;
}

let entryStore: FakeEntry[] = [];
let generatorStore: FakeGenInstance[] = [];

function insertEntry(overrides: Partial<FakeEntry> = {}): FakeEntry {
  const e: FakeEntry = {
    id: overrides.id ?? fakeUuid(),
    source: "admin",
    title: `Entry ${entryStore.length + 1}`,
    submitterName: null,
    framebuffer: Buffer.alloc(FRAME_BYTES, 0),
    createdAt: new Date(),
    updatedAt: new Date(),
    enabled: true,
    baseWeight: 1,
    conditions: [],
    lastShownAt: null,
    showCount: 0,
    ...overrides,
  };
  entryStore.push(e);
  return e;
}

function project(e: FakeEntry) {
  return {
    id: e.id,
    source: e.source,
    title: e.title,
    submitterName: e.submitterName,
    enabled: e.enabled,
    baseWeight: e.baseWeight,
    conditions: e.conditions,
    lastShownAt: e.lastShownAt,
    showCount: e.showCount,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
  };
}

// ─── Utility: extract the UUID literal from a drizzle eq() node ─────────────

function extractId(pred: any): string | undefined {
  try {
    // drizzle eq() produces: queryChunks = [sql, column, sql(' = '), Param{value}, sql]
    const chunks = pred?.queryChunks;
    if (Array.isArray(chunks)) {
      for (const chunk of chunks) {
        if (chunk && typeof chunk === "object" && "value" in chunk && typeof chunk.value === "string") {
          return chunk.value;
        }
      }
    }
  } catch {}
  return undefined;
}

// ─── Build fake DB matching drizzle's chained builder API ───────────────────

function makeFakeDb(): any {
  return {
    select: (cols?: Record<string, any>) => ({
      from: (_table: any) => {
        const keys = cols ? Object.keys(cols) : [];

        // COUNT query: select({ total: count() })
        if (keys.includes("total")) {
          return Promise.resolve([{ total: entryStore.length }]);
        }

        // Generator-instances check: select({ id: generatorInstances.id })
        // Only has "id" key and nothing else from entries projection
        const isGenCheck = keys.length === 1 && keys[0] === "id" && !keys.includes("source");

        return {
          where: (pred: any) => {
            const id = extractId(pred);

            if (isGenCheck) {
              return {
                limit: () =>
                  Promise.resolve(generatorStore.filter((g) => g.entryId === id)),
              };
            }

            // Single entry by id
            return Promise.resolve(
              entryStore.filter((e) => e.id === id).map(project),
            );
          },
          limit: (n: number) => ({
            offset: (o: number) =>
              Promise.resolve(entryStore.slice(o, o + n).map(project)),
          }),
        };
      },
    }),

    update: (_table: any) => ({
      set: (updates: Record<string, unknown>) => ({
        where: (pred: any) => ({
          returning: (_cols: any) => {
            const id = extractId(pred);
            const idx = entryStore.findIndex((e) => e.id === id);
            if (idx === -1) return Promise.resolve([]);
            Object.assign(entryStore[idx], updates);
            return Promise.resolve([{ id: entryStore[idx].id }]);
          },
        }),
      }),
    }),

    delete: (_table: any) => ({
      where: (pred: any) => ({
        returning: (_cols: any) => {
          const id = extractId(pred);
          const idx = entryStore.findIndex((e) => e.id === id);
          if (idx === -1) return Promise.resolve([]);
          const [removed] = entryStore.splice(idx, 1);
          return Promise.resolve([{ id: removed.id }]);
        },
      }),
    }),
  };
}

// ─── Mock modules that get imported at module level ─────────────────────────

// Mock env (needed for session verification via getEnv().SESSION_SECRET)
vi.mock("../../src/web/server/config/env.js", () => ({
  getEnv: () => ({
    DATABASE_URL: "fake",
    GITHUB_OAUTH_CLIENT_ID: "fake",
    GITHUB_OAUTH_CLIENT_SECRET: "fake",
    SESSION_SECRET: "test-secret-that-is-long-enough-for-hmac",
    ADMIN_GITHUB_LOGINS: "admin",
    APP_BASE_URL: "http://localhost:3000",
  }),
  parseEnv: () => ({}),
  resetEnvCache: () => {},
}));

// Mock db module (needed for routers that import db at module level, e.g. system)
vi.mock("../../src/web/server/db/index.js", () => ({
  db: {},
}));

// Mock displayNow (entry.displayNow calls it)
vi.mock("../../src/web/server/scheduler/display-now.js", () => ({
  displayNow: vi.fn().mockResolvedValue(undefined),
}));

// Mock settings (needed by system router)
vi.mock("../../src/web/server/config/settings.js", () => ({
  getSetting: vi.fn().mockResolvedValue("UTC"),
  setSetting: vi.fn().mockResolvedValue(undefined),
  seedAndValidateSettings: vi.fn().mockResolvedValue(undefined),
  invalidateCache: vi.fn(),
  onSettingChange: vi.fn(),
}));

// Mock events
vi.mock("../../src/web/server/events.js", () => ({
  emitSystemEvent: vi.fn(),
}));

// Mock lock
vi.mock("../../src/web/server/scheduler/lock.js", () => ({
  setLock: vi.fn().mockResolvedValue(undefined),
  clearLock: vi.fn().mockResolvedValue(undefined),
}));

// Mock push
vi.mock("../../src/web/server/push/push-frame.js", () => ({
  pushFrame: vi.fn().mockResolvedValue({ ok: true }),
}));

// ─── Import router + create caller ──────────────────────────────────────────

import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import type { TRPCContext } from "../../src/web/server/trpc/context.js";
import { appRouter } from "../../src/web/server/trpc/index.js";

const t = initTRPC.context<TRPCContext>().create({ transformer: superjson });

function adminCaller() {
  return t.createCallerFactory(appRouter)({
    session: { login: "admin", iat: Math.floor(Date.now() / 1000) },
    db: makeFakeDb(),
  });
}

function unauthCaller() {
  return t.createCallerFactory(appRouter)({
    session: null,
    db: makeFakeDb(),
  });
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("entry.list", () => {
  beforeEach(() => {
    entryStore = [];
    generatorStore = [];
    idSeq = 0;
  });

  it("returns empty list when no entries exist", async () => {
    const result = await adminCaller().entry.list({});
    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
  });

  it("returns paginated entries", async () => {
    insertEntry({ title: "A" });
    insertEntry({ title: "B" });
    insertEntry({ title: "C" });

    const page1 = await adminCaller().entry.list({ skip: 0, take: 2 });
    expect(page1.items).toHaveLength(2);
    expect(page1.total).toBe(3);
    expect(page1.items[0].title).toBe("A");

    const page2 = await adminCaller().entry.list({ skip: 2, take: 2 });
    expect(page2.items).toHaveLength(1);
    expect(page2.items[0].title).toBe("C");
  });

  it("rejects unauthenticated requests", async () => {
    await expect(unauthCaller().entry.list({})).rejects.toThrow("UNAUTHORIZED");
  });
});

describe("entry.get", () => {
  beforeEach(() => {
    entryStore = [];
    generatorStore = [];
    idSeq = 0;
  });

  it("returns a single entry by id", async () => {
    const e = insertEntry({ title: "Test Entry" });
    const result = await adminCaller().entry.get({ id: e.id });
    expect(result.id).toBe(e.id);
    expect(result.title).toBe("Test Entry");
  });

  it("throws NOT_FOUND for missing entry", async () => {
    await expect(
      adminCaller().entry.get({ id: MISSING_UUID }),
    ).rejects.toThrow("Entry not found");
  });
});

describe("entry.update", () => {
  beforeEach(() => {
    entryStore = [];
    generatorStore = [];
    idSeq = 0;
  });

  it("updates enabled and baseWeight", async () => {
    const e = insertEntry({ enabled: true, baseWeight: 1 });

    await adminCaller().entry.update({
      id: e.id,
      enabled: false,
      baseWeight: 5,
    });

    expect(entryStore[0].enabled).toBe(false);
    expect(entryStore[0].baseWeight).toBe(5);
  });

  it("updates title on non-generator entry", async () => {
    const e = insertEntry({ title: "Old" });
    await adminCaller().entry.update({ id: e.id, title: "New" });
    expect(entryStore[0].title).toBe("New");
  });

  it("rejects title change on generator-owned entry", async () => {
    const e = insertEntry({ title: "Gen Entry" });
    generatorStore.push({ id: fakeUuid(), entryId: e.id });

    await expect(
      adminCaller().entry.update({ id: e.id, title: "Changed" }),
    ).rejects.toThrow("Cannot change title of generator-owned entry");
  });

  it("throws NOT_FOUND for missing entry", async () => {
    await expect(
      adminCaller().entry.update({
        id: MISSING_UUID,
        enabled: false,
      }),
    ).rejects.toThrow("Entry not found");
  });
});

describe("entry.delete", () => {
  beforeEach(() => {
    entryStore = [];
    generatorStore = [];
    idSeq = 0;
  });

  it("deletes an entry", async () => {
    const e = insertEntry();
    const result = await adminCaller().entry.delete({ id: e.id });
    expect(result.id).toBe(e.id);
    expect(entryStore).toHaveLength(0);
  });

  it("rejects deleting generator-owned entry", async () => {
    const e = insertEntry();
    generatorStore.push({ id: fakeUuid(), entryId: e.id });

    await expect(
      adminCaller().entry.delete({ id: e.id }),
    ).rejects.toThrow("Cannot delete generator-owned entry");
  });

  it("throws NOT_FOUND for missing entry", async () => {
    await expect(
      adminCaller().entry.delete({ id: MISSING_UUID }),
    ).rejects.toThrow("Entry not found");
  });
});

describe("entry.displayNow", () => {
  beforeEach(() => {
    entryStore = [];
    generatorStore = [];
    idSeq = 0;
  });

  it("calls displayNow and returns ok", async () => {
    const e = insertEntry();
    const result = await adminCaller().entry.displayNow({ id: e.id });
    expect(result.ok).toBe(true);
  });
});
