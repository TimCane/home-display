import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  jsonb,
  timestamp,
  customType,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// Custom bytea type for framebuffer
const bytea = customType<{ data: Buffer }>({
  dataType() {
    return "bytea";
  },
});

// ─── entries ────────────────────────────────────────────────────────────────

export const entries = pgTable(
  "entries",
  {
    id: uuid().primaryKey().defaultRandom(),
    source: text().notNull(), // 'admin' | 'guest' | 'generator'
    title: text().notNull(),
    submitterName: text("submitter_name"),
    framebuffer: bytea("framebuffer").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    enabled: boolean().notNull().default(true),
    baseWeight: integer("base_weight").notNull().default(1),
    conditions: jsonb().notNull().default([]),
    lastShownAt: timestamp("last_shown_at", { withTimezone: true }),
    showCount: integer("show_count").notNull().default(0),
  },
  (table) => [
    check(
      "framebuffer_size",
      sql`octet_length(${table.framebuffer}) = 163200`
    ),
  ]
);

// ─── entry_drafts ───────────────────────────────────────────────────────────

export const entryDrafts = pgTable("entry_drafts", {
  id: uuid().primaryKey().defaultRandom(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  guestMode: boolean("guest_mode").notNull().default(false),
  submitterName: text("submitter_name"),
  allowedElements: jsonb("allowed_elements").notNull().default(["image_upload"]),
  enabled: boolean().notNull().default(true),
  baseWeight: integer("base_weight").notNull().default(1),
  conditions: jsonb().notNull().default([]),
});

// ─── generator_instances ────────────────────────────────────────────────────

export const generatorInstances = pgTable("generator_instances", {
  id: uuid().primaryKey().defaultRandom(),
  pluginName: text("plugin_name").notNull(),
  renderer: text().notNull(),
  instanceName: text("instance_name").notNull(),
  config: jsonb().notNull().default({}),
  cronExpr: text("cron_expr").notNull(),
  entryId: uuid("entry_id")
    .notNull()
    .references(() => entries.id, { onDelete: "cascade" }),
});

// ─── system_state ───────────────────────────────────────────────────────────

export const systemState = pgTable("system_state", {
  id: integer().primaryKey().default(1),
  currentlyDisplayedEntryId: uuid("currently_displayed_entry_id"),
  lockEntryId: uuid("lock_entry_id"),
  flags: jsonb().notNull().default({}),
  displayOnline: boolean("display_online").notNull().default(false),
  displayOnlineSince: timestamp("display_online_since", {
    withTimezone: true,
  }),
});

// ─── app_settings ───────────────────────────────────────────────────────────

export const appSettings = pgTable("app_settings", {
  key: text().primaryKey(),
  value: jsonb().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ─── push_log ───────────────────────────────────────────────────────────────

export const pushLog = pgTable("push_log", {
  id: uuid().primaryKey().defaultRandom(),
  entryId: uuid("entry_id").references(() => entries.id, {
    onDelete: "set null",
  }),
  attemptedAt: timestamp("attempted_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  succeeded: boolean().notNull(),
  firmwareStatus: text("firmware_status"),
  panelUptimeAfter: integer("panel_uptime_after"),
  error: text(),
  trigger: text().notNull(), // 'tick' | 'display_now' | 'lock_change'
});

// ─── display_status_history ─────────────────────────────────────────────────

export const displayStatusHistory = pgTable("display_status_history", {
  id: uuid().primaryKey().defaultRandom(),
  polledAt: timestamp("polled_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  reachable: boolean().notNull(),
  status: jsonb(),
});

// ─── generator_runs ─────────────────────────────────────────────────────────

export const generatorRuns = pgTable("generator_runs", {
  id: uuid().primaryKey().defaultRandom(),
  instanceId: uuid("instance_id")
    .notNull()
    .references(() => generatorInstances.id, { onDelete: "cascade" }),
  ranAt: timestamp("ran_at", { withTimezone: true }).notNull().defaultNow(),
  succeeded: boolean().notNull(),
  error: text(),
});
