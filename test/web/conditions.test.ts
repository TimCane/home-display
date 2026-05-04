import { describe, it, expect } from "vitest";
import {
  conditionSchema,
  conditionsArraySchema,
  evaluate,
  evaluateAll,
  type Condition,
  type EvalContext,
} from "../../src/web/shared/conditions.js";

function makeCtx(overrides: Partial<EvalContext> = {}): EvalContext {
  return {
    now: new Date("2026-06-15T10:30:00Z"), // Monday 15 Jun 2026, 10:30 UTC
    tz: "UTC",
    entry: {
      lastShownAt: new Date("2026-06-15T08:00:00Z"),
      updatedAt: new Date("2026-06-15T09:00:00Z"),
    },
    flags: {},
    ...overrides,
  };
}

describe("condition schema validation", () => {
  it("accepts valid time_window", () => {
    const result = conditionSchema.safeParse({
      type: "time_window",
      params: { from: "07:00", to: "09:00" },
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid day_of_week", () => {
    const result = conditionSchema.safeParse({
      type: "day_of_week",
      params: { days: ["mon", "fri"] },
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid day name", () => {
    const result = conditionSchema.safeParse({
      type: "day_of_week",
      params: { days: ["monday"] },
    });
    expect(result.success).toBe(false);
  });

  it("accepts date_range with both endpoints", () => {
    const result = conditionSchema.safeParse({
      type: "date_range",
      params: { from: "2026-12-20", to: "2026-12-26" },
    });
    expect(result.success).toBe(true);
  });

  it("accepts date_range with only from", () => {
    const result = conditionSchema.safeParse({
      type: "date_range",
      params: { from: "2026-12-20" },
    });
    expect(result.success).toBe(true);
  });

  it("validates conditions array", () => {
    const result = conditionsArraySchema.safeParse([
      { type: "time_window", params: { from: "07:00", to: "09:00" } },
      { type: "manual_flag", params: { flag: "party" } },
    ]);
    expect(result.success).toBe(true);
  });
});

describe("time_window evaluator", () => {
  const window: Condition = {
    type: "time_window",
    params: { from: "07:00", to: "12:00" },
  };

  it("true when inside window", () => {
    const ctx = makeCtx({ now: new Date("2026-06-15T10:30:00Z") });
    expect(evaluate(window, ctx)).toBe(true);
  });

  it("false when outside window", () => {
    const ctx = makeCtx({ now: new Date("2026-06-15T14:00:00Z") });
    expect(evaluate(window, ctx)).toBe(false);
  });

  it("handles midnight-crossing window", () => {
    const crossMidnight: Condition = {
      type: "time_window",
      params: { from: "22:00", to: "06:00" },
    };
    // 23:00 UTC — inside
    expect(
      evaluate(crossMidnight, makeCtx({ now: new Date("2026-06-15T23:00:00Z") })),
    ).toBe(true);
    // 02:00 UTC — inside
    expect(
      evaluate(crossMidnight, makeCtx({ now: new Date("2026-06-15T02:00:00Z") })),
    ).toBe(true);
    // 12:00 UTC — outside
    expect(
      evaluate(crossMidnight, makeCtx({ now: new Date("2026-06-15T12:00:00Z") })),
    ).toBe(false);
  });

  it("respects timezone (BST offset)", () => {
    // 2026-06-15 is in BST (UTC+1).
    // At 10:30 UTC it's 11:30 BST — inside 11:00–12:00 in London, outside in UTC.
    const bstWindow: Condition = {
      type: "time_window",
      params: { from: "11:00", to: "12:00" },
    };
    const ctx = makeCtx({
      now: new Date("2026-06-15T10:30:00Z"),
      tz: "Europe/London",
    });
    expect(evaluate(bstWindow, ctx)).toBe(true);

    // Same instant in UTC is 10:30 — outside the 11:00–12:00 window
    const ctxUtc = makeCtx({
      now: new Date("2026-06-15T10:30:00Z"),
      tz: "UTC",
    });
    expect(evaluate(bstWindow, ctxUtc)).toBe(false);
  });
});

describe("day_of_week evaluator", () => {
  const weekday: Condition = {
    type: "day_of_week",
    params: { days: ["mon", "tue", "wed", "thu", "fri"] },
  };

  it("true on a weekday", () => {
    // 2026-06-15 is Monday
    expect(evaluate(weekday, makeCtx())).toBe(true);
  });

  it("false on weekend", () => {
    // 2026-06-13 is Saturday
    const ctx = makeCtx({ now: new Date("2026-06-13T10:00:00Z") });
    expect(evaluate(weekday, ctx)).toBe(false);
  });
});

describe("date_range evaluator", () => {
  it("true when inside range", () => {
    const cond: Condition = {
      type: "date_range",
      params: { from: "2026-06-10", to: "2026-06-20" },
    };
    expect(evaluate(cond, makeCtx())).toBe(true);
  });

  it("false when before range", () => {
    const cond: Condition = {
      type: "date_range",
      params: { from: "2026-07-01", to: "2026-07-10" },
    };
    expect(evaluate(cond, makeCtx())).toBe(false);
  });

  it("true with only from (from X onwards)", () => {
    const cond: Condition = {
      type: "date_range",
      params: { from: "2026-01-01" },
    };
    expect(evaluate(cond, makeCtx())).toBe(true);
  });

  it("true with only to (until X)", () => {
    const cond: Condition = {
      type: "date_range",
      params: { to: "2026-12-31" },
    };
    expect(evaluate(cond, makeCtx())).toBe(true);
  });
});

describe("manual_flag evaluator", () => {
  const cond: Condition = {
    type: "manual_flag",
    params: { flag: "guests_over" },
  };

  it("true when flag is set", () => {
    const ctx = makeCtx({ flags: { guests_over: true } });
    expect(evaluate(cond, ctx)).toBe(true);
  });

  it("false when flag is missing", () => {
    expect(evaluate(cond, makeCtx())).toBe(false);
  });

  it("false when flag is false", () => {
    const ctx = makeCtx({ flags: { guests_over: false } });
    expect(evaluate(cond, ctx)).toBe(false);
  });
});

describe("freshness evaluator", () => {
  const cond: Condition = {
    type: "freshness",
    params: { not_shown_in_last_hours: 24 },
  };

  it("true when never shown", () => {
    const ctx = makeCtx({
      entry: { lastShownAt: null, updatedAt: new Date() },
    });
    expect(evaluate(cond, ctx)).toBe(true);
  });

  it("false when recently shown", () => {
    // lastShownAt = 2.5h ago (default ctx)
    expect(evaluate(cond, makeCtx())).toBe(false);
  });

  it("true when shown long ago", () => {
    const ctx = makeCtx({
      entry: {
        lastShownAt: new Date("2026-06-13T10:00:00Z"), // 2 days ago
        updatedAt: new Date(),
      },
    });
    expect(evaluate(cond, ctx)).toBe(true);
  });
});

describe("recently_updated evaluator", () => {
  const cond: Condition = {
    type: "recently_updated",
    params: { updated_within_hours: 6 },
  };

  it("true when recently updated", () => {
    // updatedAt = 1.5h ago in default ctx
    expect(evaluate(cond, makeCtx())).toBe(true);
  });

  it("false when stale", () => {
    const ctx = makeCtx({
      entry: {
        lastShownAt: null,
        updatedAt: new Date("2026-06-10T10:00:00Z"), // 5 days ago
      },
    });
    expect(evaluate(cond, ctx)).toBe(false);
  });
});

describe("evaluateAll", () => {
  it("empty conditions = always true", () => {
    expect(evaluateAll([], makeCtx())).toBe(true);
  });

  it("AND: all must pass", () => {
    const conditions: Condition[] = [
      { type: "time_window", params: { from: "07:00", to: "12:00" } },
      { type: "day_of_week", params: { days: ["mon"] } },
    ];
    expect(evaluateAll(conditions, makeCtx())).toBe(true);
  });

  it("AND: one failing makes all fail", () => {
    const conditions: Condition[] = [
      { type: "time_window", params: { from: "07:00", to: "12:00" } },
      { type: "manual_flag", params: { flag: "nope" } },
    ];
    expect(evaluateAll(conditions, makeCtx())).toBe(false);
  });
});
