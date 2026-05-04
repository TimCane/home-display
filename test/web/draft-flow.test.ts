/**
 * Integration tests for the draft lifecycle: create -> list -> revoke -> commit.
 *
 * The draft router reads from ctx.db, so we inject a fake drizzle-like db
 * through the tRPC context. The draft.get and draft.commit procedures also
 * call draftGate() which imports the global db, so we mock that too.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { FRAME_BYTES } from "../../src/web/shared/framebuffer.js";

// ─── Valid UUID generator ───────────────────────────────────────────────────

let idSeq = 0;

function fakeUuid() {
  idSeq++;
  const hex = String(idSeq).padStart(12, "0");
  return `00000000-0000-4000-a000-${hex}`;
}

const MISSING_UUID = "11111111-1111-4111-a111-111111111111";

// ─── In-memory stores ───────────────────────────────────────────────────────

interface FakeDraft {
  id: string;
  createdAt: Date;
  expiresAt: Date;
  consumedAt: Date | null;
  guestMode: boolean;
  submitterName: string | null;
  allowedElements: string[];
  enabled: boolean;
  baseWeight: number;
  conditions: unknown[];
}

interface FakeEntry {
  id: string;
  source: string;
  title: string;
  submitterName: string | null;
  framebuffer: Buffer;
  enabled: boolean;
  baseWeight: number;
  conditions: unknown[];
  showCount: number;
}

let draftStore: FakeDraft[] = [];
let entryStore: FakeEntry[] = [];

// ─── Extract UUID from drizzle eq() predicate ───────────────────────────────

function extractId(pred: any): string | undefined {
  try {
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

// ─── Build fake DB ──────────────────────────────────────────────────────────

function makeFakeDb(): any {
  return {
    select: (cols?: Record<string, any>) => ({
      from: (_table: any) => {
        const keys = cols ? Object.keys(cols) : [];

        // COUNT query: select({ total: count() }).from().where()
        if (keys.includes("total")) {
          return {
            where: () => Promise.resolve([{ total: draftStore.length }]),
          };
        }

        return {
          where: (pred: any) => {
            const id = extractId(pred);
            // Single draft by id
            if (id) {
              const draft = draftStore.find((d) => d.id === id);
              if (draft) {
                return {
                  limit: () => Promise.resolve([draft]),
                  for: () => Promise.resolve([draft]),
                };
              }
              const entry = entryStore.find((e) => e.id === id);
              if (entry) return { limit: () => Promise.resolve([entry]) };
              return {
                limit: () => Promise.resolve([]),
                for: () => Promise.resolve([]),
              };
            }
            // List query (where with conditions, not a UUID)
            return {
              orderBy: () => ({
                limit: (n: number) => ({
                  offset: (o: number) =>
                    Promise.resolve(draftStore.slice(o, o + n)),
                }),
              }),
            };
          },
          orderBy: () => ({
            limit: (n: number) => ({
              offset: (o: number) =>
                Promise.resolve(draftStore.slice(o, o + n)),
            }),
          }),
        };
      },
    }),

    insert: (_table: any) => ({
      values: (row: any) => ({
        returning: (_cols: any) => {
          const id = fakeUuid();
          if ("expiresAt" in row) {
            // Draft insert
            draftStore.push({ id, createdAt: new Date(), consumedAt: null, ...row });
            return Promise.resolve([{ id }]);
          } else {
            // Entry insert
            entryStore.push({ id, ...row });
            return Promise.resolve([{ id }]);
          }
        },
      }),
    }),

    update: (_table: any) => ({
      set: (updates: Record<string, unknown>) => ({
        where: (pred: any) => {
          const id = extractId(pred);
          const draftIdx = draftStore.findIndex((d) => d.id === id);
          if (draftIdx !== -1) {
            Object.assign(draftStore[draftIdx], updates);
            return {
              returning: () => Promise.resolve([{ id: draftStore[draftIdx].id }]),
            };
          }
          return { returning: () => Promise.resolve([]) };
        },
      }),
    }),

    transaction: async (fn: (tx: any) => Promise<any>) => {
      const tx: any = {
        select: (cols?: Record<string, any>) => ({
          from: (_table: any) => ({
            where: (pred: any) => ({
              for: (_mode: string) => {
                const id = extractId(pred);
                const draft = draftStore.find((d) => d.id === id);
                return Promise.resolve(draft ? [draft] : []);
              },
            }),
          }),
        }),
        insert: (_table: any) => ({
          values: (row: any) => ({
            returning: (_cols: any) => {
              const id = fakeUuid();
              entryStore.push({ id, ...row });
              return Promise.resolve([{ id }]);
            },
          }),
        }),
        update: (_table: any) => ({
          set: (updates: Record<string, unknown>) => ({
            where: (pred: any) => {
              const id = extractId(pred);
              const idx = draftStore.findIndex((d) => d.id === id);
              if (idx !== -1) Object.assign(draftStore[idx], updates);
              return Promise.resolve();
            },
          }),
        }),
      };
      return fn(tx);
    },
  };
}

// ─── Mocks ──────────────────────────────────────────────────────────────────

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

// Mock the global db import (used by draftGate and other modules)
vi.mock("../../src/web/server/db/index.js", () => {
  // draftGate imports db at module level and uses it to look up drafts.
  // We need this mock to also work with our in-memory store.
  const db: any = {
    select: () => ({
      from: (_table: any) => ({
        where: (pred: any) => ({
          limit: () => {
            const chunks = pred?.queryChunks;
            let id: string | undefined;
            if (Array.isArray(chunks)) {
              for (const chunk of chunks) {
                if (chunk && typeof chunk === "object" && "value" in chunk && typeof chunk.value === "string") {
                  id = chunk.value;
                  break;
                }
              }
            }
            const draft = draftStore.find((d) => d.id === id);
            return Promise.resolve(draft ? [draft] : []);
          },
        }),
      }),
    }),
  };
  return { db };
});

vi.mock("../../src/web/server/scheduler/display-now.js", () => ({
  displayNow: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../src/web/server/config/settings.js", () => ({
  getSetting: vi.fn().mockResolvedValue("UTC"),
  setSetting: vi.fn().mockResolvedValue(undefined),
  seedAndValidateSettings: vi.fn().mockResolvedValue(undefined),
  invalidateCache: vi.fn(),
  onSettingChange: vi.fn(),
}));

vi.mock("../../src/web/server/events.js", () => ({
  emitSystemEvent: vi.fn(),
}));

vi.mock("../../src/web/server/scheduler/lock.js", () => ({
  setLock: vi.fn().mockResolvedValue(undefined),
  clearLock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../src/web/server/push/push-frame.js", () => ({
  pushFrame: vi.fn().mockResolvedValue({ ok: true }),
}));

// ─── Import router + create caller ───────────────────────────────────���──────

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

function publicCaller() {
  return t.createCallerFactory(appRouter)({
    session: null,
    db: makeFakeDb(),
  });
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("draft.create", () => {
  beforeEach(() => {
    draftStore = [];
    entryStore = [];
    idSeq = 0;
  });

  it("creates a draft with defaults", async () => {
    const result = await adminCaller().draft.create({});
    expect(result.id).toBeDefined();
    expect(draftStore).toHaveLength(1);
    expect(draftStore[0].guestMode).toBe(false);
    expect(draftStore[0].allowedElements).toEqual(["image_upload"]);
    expect(draftStore[0].enabled).toBe(true);
    expect(draftStore[0].baseWeight).toBe(1);
  });

  it("creates a guest draft with custom settings", async () => {
    await adminCaller().draft.create({
      guestMode: true,
      submitterName: "Guest User",
      allowedElements: ["image_upload", "text"],
      baseWeight: 3,
    });
    expect(draftStore[0].guestMode).toBe(true);
    expect(draftStore[0].submitterName).toBe("Guest User");
    expect(draftStore[0].baseWeight).toBe(3);
  });

  it("rejects unauthenticated draft creation", async () => {
    await expect(publicCaller().draft.create({})).rejects.toThrow(
      "UNAUTHORIZED",
    );
  });
});

describe("draft.list", () => {
  beforeEach(() => {
    draftStore = [];
    entryStore = [];
    idSeq = 0;
  });

  it("lists all drafts", async () => {
    await adminCaller().draft.create({});
    await adminCaller().draft.create({ guestMode: true });

    const result = await adminCaller().draft.list({ filter: "all" });
    expect(result.items).toHaveLength(2);
    expect(result.total).toBe(2);
  });
});

describe("draft.revoke", () => {
  beforeEach(() => {
    draftStore = [];
    entryStore = [];
    idSeq = 0;
  });

  it("marks a draft as consumed", async () => {
    const { id } = await adminCaller().draft.create({});
    expect(draftStore[0].consumedAt).toBeNull();

    await adminCaller().draft.revoke({ id });
    expect(draftStore[0].consumedAt).toBeInstanceOf(Date);
  });

  it("throws NOT_FOUND for missing draft", async () => {
    await expect(
      adminCaller().draft.revoke({ id: MISSING_UUID }),
    ).rejects.toThrow("Draft not found");
  });
});

describe("draft.commit (publish flow)", () => {
  beforeEach(() => {
    draftStore = [];
    entryStore = [];
    idSeq = 0;
  });

  it("creates an entry from a guest draft and marks it consumed", async () => {
    const { id: draftId } = await adminCaller().draft.create({
      guestMode: true,
      submitterName: "Alice",
      baseWeight: 2,
    });

    const frame = Buffer.alloc(FRAME_BYTES, 0).toString("base64");
    const result = await publicCaller().draft.commit({
      id: draftId,
      title: "My Drawing",
      frame,
    });

    expect(result.entryId).toBeDefined();

    // Draft should be consumed
    expect(draftStore[0].consumedAt).toBeInstanceOf(Date);

    // Entry should be created
    expect(entryStore).toHaveLength(1);
    expect(entryStore[0].title).toBe("My Drawing");
    expect(entryStore[0].source).toBe("guest");
    expect(entryStore[0].submitterName).toBe("Alice");
    expect(entryStore[0].baseWeight).toBe(2);
  });

  it("rejects commit with wrong frame size", async () => {
    const { id: draftId } = await adminCaller().draft.create({
      guestMode: true,
    });

    const tooSmall = Buffer.alloc(100, 0).toString("base64");
    await expect(
      publicCaller().draft.commit({
        id: draftId,
        title: "Bad",
        frame: tooSmall,
      }),
    ).rejects.toThrow(`Frame must be exactly ${FRAME_BYTES} bytes`);
  });

  it("rejects commit on already-consumed draft", async () => {
    const { id: draftId } = await adminCaller().draft.create({
      guestMode: true,
    });

    // Manually consume it
    draftStore[0].consumedAt = new Date();

    const frame = Buffer.alloc(FRAME_BYTES, 0).toString("base64");
    await expect(
      publicCaller().draft.commit({
        id: draftId,
        title: "Late",
        frame,
      }),
    ).rejects.toThrow("already been used");
  });

  it("rejects commit on expired draft", async () => {
    const { id: draftId } = await adminCaller().draft.create({
      guestMode: true,
    });

    // Expire it
    draftStore[0].consumedAt = null;
    draftStore[0].expiresAt = new Date(Date.now() - 1000);

    const frame = Buffer.alloc(FRAME_BYTES, 0).toString("base64");
    await expect(
      publicCaller().draft.commit({
        id: draftId,
        title: "Expired",
        frame,
      }),
    ).rejects.toThrow("expired");
  });

  it("rejects non-guest draft without admin session", async () => {
    const { id: draftId } = await adminCaller().draft.create({
      guestMode: false,
    });

    const frame = Buffer.alloc(FRAME_BYTES, 0).toString("base64");
    await expect(
      publicCaller().draft.commit({
        id: draftId,
        title: "Should fail",
        frame,
      }),
    ).rejects.toThrow("Admin session required");
  });
});
