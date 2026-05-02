# Step 13 — tRPC routers + side endpoints

## Goal

Land the admin-facing API surface for entries, system state, settings, and diagnostics, plus the two non-tRPC endpoints (`/api/framebuffer/<id>`, `/api/sse/system`).

## Depends on

Steps 8, 10, 11, 12.

## Files

- `src/web/server/trpc/routers/entry.ts`
- `src/web/server/trpc/routers/system.ts`
- `src/web/server/trpc/routers/settings.ts`
- `src/web/server/trpc/routers/diagnostics.ts`
- `src/web/server/trpc/index.ts` — register routers in `appRouter`
- `src/web/server/http/framebuffer.ts` — `GET /api/framebuffer/<entry_id>`
- `src/web/server/http/sse-system.ts` — `GET /api/sse/system`
- `src/web/server/events.ts` — tiny in-process pub/sub for `system_state` changes (used by SSE)

## Tasks

1. `entry` router:
   - `list()` → all entries with metadata (no framebuffer bytes).
   - `get(id)` → single entry metadata.
   - `update(id, patch)` → admin-editable fields (`enabled`, `base_weight`, `conditions`, `title` if non-generator).
   - `delete(id)` → reject if generator-owned; else hard delete.
   - `displayNow(id)` → calls `displayNow` from step 12.
2. `system` router:
   - `lock(entryId)` / `unlock()` → step 12.
   - `setFlag(name, value)` → mutate `system_state.flags`; emit change event.
   - `pushTestPattern()` → generate a 4-quadrant frame in-memory and push it (no `entries` row).
3. `settings` router:
   - `getAll()` → every key + current value.
   - `set(key, value)` → validate via the per-key Zod schema, persist, invalidate cache.
4. `diagnostics` router:
   - `recentPushes(limit)` → last N `push_log` rows.
   - `statusHistory(limit)` → last N `display_status_history` rows.
   - `latestStatus()` → most recent `display_status_history.status`.
   - `generatorRuns(instanceId?, limit)` → last N runs, optionally filtered.
5. `GET /api/framebuffer/<entry_id>`:
   - Admin session required.
   - Stream the 163,200 bytes with `Content-Type: application/octet-stream`.
6. `GET /api/sse/system`:
   - Admin session required.
   - Subscribe to events; emit on every `system_state` change (lock, displayed entry, flags, online).
7. Wire up the in-process event bus: `pushFrame` success, `setLock`, `setFlag`, health-check transitions all emit.

## Acceptance

- `curl /api/trpc/entry.list` (with a session cookie) returns JSON of seeded entries.
- `entry.update` rejects unauthorized fields and persists allowed ones.
- `system.pushTestPattern` causes the mock display to receive a 163,200-byte POST.
- `/api/framebuffer/<id>` streams correct-length bytes that decode back to the original via `decode2bpp`.
- Two SSE clients connected; toggling a flag pushes an event to both.

## Notes

- All procedures are `adminProcedure` from step 8.
- Naming: singular noun + verb, per [architecture.md § tRPC routers](../architecture.md#trpc-routers).
- `draft` and `generator` routers land in steps 14 and 15.
