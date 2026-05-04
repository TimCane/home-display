# Data model

Postgres, accessed via Drizzle. Framebuffers are stored as `bytea` in-DB (159 KiB each, hundreds of rows expected). The original images uploaded by guests are *not* retained — once dithered into a framebuffer, the source is discarded.

## Tables

### `entries`

The library of things the panel can show. One row = one displayable image.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `source` | text | `admin` \| `guest` \| `generator`. For generator entries the owning plugin/instance is recoverable via `generator_instances.entry_id`. |
| `title` | text | Admin-facing label |
| `submitter_name` | text nullable | Guest source only; admin-set at link creation, immutable |
| `framebuffer` | bytea | Exactly 163,200 bytes. Immutable for admin/guest entries. Generators rewrite their own. |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | Bumped on any row mutation (framebuffer rewrite, admin field edit, etc.). Drives the `recently_updated` condition. |
| `enabled` | bool | Admin toggle |
| `base_weight` | int | Default 1. Used by scheduler scoring. |
| `conditions` | jsonb | Array of `{type, params}`. AND-ed. See [scheduler.md](scheduler.md). A periodic sweep auto-disables the entry when its conditions imply it can never match again (e.g. a `date_range` with `to` in the past). |
| `last_shown_at` | timestamptz nullable | Updated on every successful push *and* on every tick the entry is locked. |
| `show_count` | int | Default 0. Bumped on every successful push. Drives the global first-view boost (`show_count == 0` → `app_settings.first_view_boost` added to score). |

Generator-owned entries: the plugin owns `title` and `framebuffer`. The admin owns `enabled`, `conditions`, `base_weight`. Direct deletion of generator-owned entries is blocked in the UI — delete the generator instance to cascade.

### `entry_drafts`

A pending editor session. Both admin self-creation and guest-shared submission flow through this table. The `guest_mode` flag determines element filtering, the modal post-save UX, and an extra admin-session gate. See [entry-drafts.md](entry-drafts.md).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK; this *is* the URL slug |
| `created_at` | timestamptz | |
| `expires_at` | timestamptz | 24h from creation — the draft's TTL (controls when the editor link stops working, not when the resulting entry stops being eligible) |
| `consumed_at` | timestamptz nullable | Set on submission. Also set by manual revoke. |
| `guest_mode` | bool | Drives element filter, modal UX, and auth gate |
| `submitter_name` | text nullable | Required when `guest_mode = true`, null otherwise |
| `allowed_elements` | jsonb | Subset of editor element types. Default `["image_upload"]`. Meaningful only when `guest_mode = true`. |
| `enabled` | bool | Preset for the eventual entry, default `true` |
| `base_weight` | int | Preset, default 1 |
| `conditions` | jsonb | Preset, default `[]` |

Draft is valid until `consumed_at IS NOT NULL` or `now() > expires_at`, whichever first. On commit, preset columns are copied into the new `entries` row, `show_count` is initialized to `0` (so the global first-view boost applies), `consumed_at` is set, and `entries.source = guest_mode ? 'guest' : 'admin'`. Note: `expires_at` controls the editor-link lifetime only and has no effect on the resulting entry's eligibility — that's purely conditions-driven.

### `generator_instances`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `plugin_name` | text | e.g. `weather`, `calendar` |
| `renderer` | text | Plugin-defined: e.g. `today`, `5day` |
| `instance_name` | text | Admin-facing, e.g. `"Home weather - today"` |
| `config` | jsonb | Plugin-validated via Zod schema |
| `cron_expr` | text | Per-instance fetch/render cadence |
| `entry_id` | uuid FK → entries(id) | The entry this instance owns |

One instance owns exactly one entry. Cascade delete: deleting an instance deletes its entry.

### `system_state`

Singleton (single row, `id = 1`).

| Column | Type | Notes |
|---|---|---|
| `currently_displayed_entry_id` | uuid nullable | Source of truth for "what's on the panel" |
| `lock_entry_id` | uuid nullable | When set, scheduler ticks skip selection |
| `flags` | jsonb | `{<flag_name>: bool}`, used by `manual_flag` conditions |
| `display_online` | bool | Last health check result |
| `display_online_since` | timestamptz nullable | |

### `app_settings`

Generic key-value config so adding new settings does not require a migration. App-side Zod validates on read/write; defaults applied if key missing.

| Column | Type | Notes |
|---|---|---|
| `key` | text | PK |
| `value` | jsonb | |
| `updated_at` | timestamptz | |

Current keys, shapes, and defaults: see [config.md](config.md#db-app_settings-keys). That doc is also where the env-vs-DB split lives.

### `push_log`

Forever retention. Diagnostics + retry observability.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `entry_id` | uuid FK | The frame attempted |
| `attempted_at` | timestamptz | |
| `succeeded` | bool | |
| `firmware_status` | text nullable | `accepted` \| `queued` \| `503` \| etc. |
| `panel_uptime_after` | int nullable | From `/status` confirmation |
| `error` | text nullable | |
| `trigger` | text | `tick` \| `display_now` \| `lock_change` |

### `display_status_history`

Periodic `/status` poll log. Forever retention. Used for "is the panel reachable" diagnostics and uptime trends.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `polled_at` | timestamptz | |
| `reachable` | bool | |
| `status` | jsonb | Full `/status` response when reachable |

### `generator_runs`

Per-run log for generator instances. Forever retention.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `instance_id` | uuid FK | |
| `ran_at` | timestamptz | |
| `succeeded` | bool | |
| `error` | text nullable | |

## Entry creation paths

Three sources, two paths:

| Source | Path | Notes |
|---|---|---|
| Admin self-authored | `entry_drafts` (one-click modal) → `/editor/<uuid>` → INSERT into `entries` on commit | Draft `guest_mode = false`. Editor link gated by admin session. |
| Guest submission | `entry_drafts` (admin opens modal with `guest entry` checked, shares link) → `/editor/<uuid>` → INSERT into `entries` on commit | Draft `guest_mode = true`. Link is the only credential. |
| Generator | `generator_instances` row created → placeholder INSERT into `entries` immediately → cron rewrites `framebuffer` on schedule | No draft, no editor. The instance owns the entry; cascade delete removes it. |

Why generators skip drafts: drafts model an authoring handoff (one human, one editor session, optional sharing). Generators have no human authoring step, so the draft machinery is ceremony with no payoff.

Why drafts and entries are not unified: `entries.framebuffer` is `NOT NULL` and CHECKed at 163,200 bytes — that invariant lets the scheduler trust every entry is pushable. Folding drafts in would make `framebuffer` nullable, require a `status` enum on every query, and leave draft-only columns (`expires_at`, `consumed_at`, `guest_mode`, `allowed_elements`) sitting nullable on every active entry forever.

## Conventions

- All timestamps are `timestamptz`. App-layer code interprets in `app_settings.app_tz` for user-facing display and condition evaluation.
- `conditions` JSONB shape: array of `{type: <enum>, params: <type-specific object>}`. AND-ed. See [scheduler.md](scheduler.md) for type list.
- `framebuffer` is always exactly 163,200 bytes. CHECK constraint enforces this.
- No soft-delete. Hard delete. The `push_log` history retains the `entry_id` even after deletion (FK is `ON DELETE SET NULL`).
