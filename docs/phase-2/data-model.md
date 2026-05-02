# Data model

Postgres, accessed via Drizzle. Framebuffers are stored as `bytea` in-DB (159 KiB each, hundreds of rows expected). The original images uploaded by guests are *not* retained — once dithered into a framebuffer, the source is discarded.

## Tables

### `entries`

The library of things the panel can show. One row = one displayable image.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `source` | text | `admin` \| `guest` \| `generator:<plugin_name>` |
| `title` | text | Admin-facing label |
| `submitter_name` | text nullable | Guest source only; admin-set at link creation, immutable |
| `framebuffer` | bytea | Exactly 163,200 bytes. Immutable for admin/guest entries. Generators rewrite their own. |
| `created_at` | timestamptz | |
| `enabled` | bool | Admin toggle |
| `base_weight` | int | Default 1. Used by scheduler scoring. |
| `conditions` | jsonb | Array of `{type, params}`. AND-ed. See [scheduler.md](scheduler.md). |
| `first_view_boost` | int | Extra weight applied while `last_shown_at IS NULL` |
| `display_until` | timestamptz nullable | Auto-becomes ineligible after this date — stops being shown on the panel |
| `last_shown_at` | timestamptz nullable | Updated on every successful push *and* on every tick the entry is locked. |
| `show_count` | int | Diagnostics |

Generator-owned entries: the plugin owns `title` and `framebuffer`. The admin owns `enabled`, `conditions`, `base_weight`, `display_until`. Direct deletion of generator-owned entries is blocked in the UI — delete the generator instance to cascade.

### `entry_drafts`

A pending editor session. Both admin self-creation and guest-shared submission flow through this table. The `guest_mode` flag determines element filtering, the modal post-save UX, and an extra admin-session gate. See [entry-drafts.md](entry-drafts.md).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK; this *is* the URL slug |
| `created_at` | timestamptz | |
| `expires_at` | timestamptz | 24h from creation — the draft's TTL, distinct from `display_until` |
| `consumed_at` | timestamptz nullable | Set on submission. Also set by manual revoke. |
| `guest_mode` | bool | Drives element filter, modal UX, and auth gate |
| `submitter_name` | text nullable | Required when `guest_mode = true`, null otherwise |
| `allowed_elements` | jsonb | Subset of editor element types. Default `["image_upload"]`. Meaningful only when `guest_mode = true`. |
| `enabled` | bool | Preset for the eventual entry, default `true` |
| `base_weight` | int | Preset, default 1 |
| `conditions` | jsonb | Preset, default `[]` |
| `display_until` | timestamptz nullable | Preset; becomes the entry's `display_until` at commit |
| `first_view_boost` | int | Preset |

Draft is valid until `consumed_at IS NOT NULL` or `now() > expires_at`, whichever first. On commit, preset columns are copied into the new `entries` row, `consumed_at` is set, and `entries.source = guest_mode ? 'guest' : 'admin'`.

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

Known V1 keys:

| Key | Shape | Default |
|---|---|---|
| `palette` | `{black, white, yellow, red}` (RGB hex strings) | Vendor sample values |
| `scheduler_cron` | string | `*/30 * * * *` |
| `app_tz` | string (IANA) | `Europe/London` |
| `health_check_minutes` | int | 5 |
| `display_base_url` | string | (set per deploy) |
| `display_token` | string | Must match firmware's compile-time `EPD_TOKEN` |

See [config.md](config.md) for the full env-vs-DB split.

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

## Conventions

- All timestamps are `timestamptz`. App-layer code interprets in `app_settings.app_tz` for user-facing display and condition evaluation.
- `conditions` JSONB shape: array of `{type: <enum>, params: <type-specific object>}`. AND-ed. See [scheduler.md](scheduler.md) for type list.
- `framebuffer` is always exactly 163,200 bytes. CHECK constraint enforces this.
- No soft-delete. Hard delete. The `push_log` history retains the `entry_id` even after deletion (FK is `ON DELETE SET NULL`).
