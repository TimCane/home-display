/**
 * Condition schemas (Zod) and pure evaluator functions.
 *
 * Each entry has a `conditions` JSONB array. All conditions are AND-ed:
 * an empty array means "always eligible."
 */

import { z } from "zod/v4";

// ─── Schemas ────────────────────────────────────────────────────────────────

const timeWindowSchema = z.object({
  type: z.literal("time_window"),
  params: z.object({
    from: z.string(), // "HH:MM"
    to: z.string(),   // "HH:MM"
  }),
});

const dayOfWeekSchema = z.object({
  type: z.literal("day_of_week"),
  params: z.object({
    days: z.array(
      z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]),
    ),
  }),
});

const dateRangeSchema = z.object({
  type: z.literal("date_range"),
  params: z.object({
    from: z.string().optional(), // "YYYY-MM-DD"
    to: z.string().optional(),   // "YYYY-MM-DD"
  }),
});

const manualFlagSchema = z.object({
  type: z.literal("manual_flag"),
  params: z.object({
    flag: z.string(),
  }),
});

const freshnessSchema = z.object({
  type: z.literal("freshness"),
  params: z.object({
    not_shown_in_last_hours: z.number(),
  }),
});

const recentlyUpdatedSchema = z.object({
  type: z.literal("recently_updated"),
  params: z.object({
    updated_within_hours: z.number(),
  }),
});

export const conditionSchema = z.discriminatedUnion("type", [
  timeWindowSchema,
  dayOfWeekSchema,
  dateRangeSchema,
  manualFlagSchema,
  freshnessSchema,
  recentlyUpdatedSchema,
]);

export type Condition = z.infer<typeof conditionSchema>;

export const conditionsArraySchema = z.array(conditionSchema);

// ─── Evaluator context ──────────────────────────────────────────────────────

export interface EvalContext {
  now: Date;
  tz: string; // IANA timezone, e.g. "Europe/London"
  entry: {
    lastShownAt: Date | null;
    updatedAt: Date;
  };
  flags: Record<string, boolean>;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Parse "HH:MM" to minutes since midnight. */
function parseHHMM(s: string): number {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
}

/** Get current minutes-since-midnight in the given timezone. */
function nowMinutes(now: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const h = Number(parts.find((p) => p.type === "hour")!.value);
  const m = Number(parts.find((p) => p.type === "minute")!.value);
  return h * 60 + m;
}

const DAY_NAMES = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

/** Get day-of-week name in the given timezone. */
function nowDayName(now: Date, tz: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    weekday: "short",
  }).formatToParts(now);
  const weekday = parts.find((p) => p.type === "weekday")!.value.toLowerCase();
  // Intl gives "mon", "tue", etc. — already matches our enum
  return weekday;
}

/** Get today's date string "YYYY-MM-DD" in the given timezone. */
function nowDateStr(now: Date, tz: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const y = parts.find((p) => p.type === "year")!.value;
  const mo = parts.find((p) => p.type === "month")!.value;
  const d = parts.find((p) => p.type === "day")!.value;
  return `${y}-${mo}-${d}`;
}

// ─── Per-type evaluators ────────────────────────────────────────────────────

function evalTimeWindow(
  condition: z.infer<typeof timeWindowSchema>,
  ctx: EvalContext,
): boolean {
  const from = parseHHMM(condition.params.from);
  const to = parseHHMM(condition.params.to);
  const current = nowMinutes(ctx.now, ctx.tz);

  if (from <= to) {
    // Normal window: e.g. 07:00 – 09:00
    return current >= from && current < to;
  }
  // Crosses midnight: e.g. 22:00 – 06:00
  return current >= from || current < to;
}

function evalDayOfWeek(
  condition: z.infer<typeof dayOfWeekSchema>,
  ctx: EvalContext,
): boolean {
  const today = nowDayName(ctx.now, ctx.tz);
  return condition.params.days.includes(today as typeof condition.params.days[number]);
}

function evalDateRange(
  condition: z.infer<typeof dateRangeSchema>,
  ctx: EvalContext,
): boolean {
  const today = nowDateStr(ctx.now, ctx.tz);
  if (condition.params.from && today < condition.params.from) return false;
  if (condition.params.to && today > condition.params.to) return false;
  return true;
}

function evalManualFlag(
  condition: z.infer<typeof manualFlagSchema>,
  ctx: EvalContext,
): boolean {
  return ctx.flags[condition.params.flag] === true;
}

function evalFreshness(
  condition: z.infer<typeof freshnessSchema>,
  ctx: EvalContext,
): boolean {
  if (ctx.entry.lastShownAt === null) return true;
  const hoursSince =
    (ctx.now.getTime() - ctx.entry.lastShownAt.getTime()) / (1000 * 60 * 60);
  return hoursSince >= condition.params.not_shown_in_last_hours;
}

function evalRecentlyUpdated(
  condition: z.infer<typeof recentlyUpdatedSchema>,
  ctx: EvalContext,
): boolean {
  const hoursSince =
    (ctx.now.getTime() - ctx.entry.updatedAt.getTime()) / (1000 * 60 * 60);
  return hoursSince <= condition.params.updated_within_hours;
}

// ─── Dispatcher ─────────────────────────────────────────────────────────────

/** Evaluate a single condition against the context. */
export function evaluate(condition: Condition, ctx: EvalContext): boolean {
  switch (condition.type) {
    case "time_window":
      return evalTimeWindow(condition, ctx);
    case "day_of_week":
      return evalDayOfWeek(condition, ctx);
    case "date_range":
      return evalDateRange(condition, ctx);
    case "manual_flag":
      return evalManualFlag(condition, ctx);
    case "freshness":
      return evalFreshness(condition, ctx);
    case "recently_updated":
      return evalRecentlyUpdated(condition, ctx);
  }
}

/** Evaluate all conditions (AND). Empty array = always true. */
export function evaluateAll(
  conditions: Condition[],
  ctx: EvalContext,
): boolean {
  return conditions.every((c) => evaluate(c, ctx));
}
