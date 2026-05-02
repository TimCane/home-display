# Step 18 — Admin pages

## Goal

Fill in every admin route from [architecture.md § Admin SPA pages](../architecture.md#admin-spa-pages) except the editor and the draft modal: dashboard, entries, drafts list, generators, settings, diagnostics.

## Depends on

Steps 13, 15, 17.

## Files

- `src/web/client/pages/Dashboard.tsx`
- `src/web/client/pages/Entries.tsx`
- `src/web/client/pages/Drafts.tsx`
- `src/web/client/pages/Generators.tsx`
- `src/web/client/pages/Settings.tsx`
- `src/web/client/pages/Diagnostics.tsx`
- `src/web/client/components/FramebufferImage.tsx` — fetches `/api/framebuffer/<id>` and decodes via shared `decode2bpp`
- `src/web/client/components/ConditionsEditor.tsx` — JSON-driven form per condition type
- `src/web/client/hooks/useSystemState.ts` — SSE subscription

## Tasks

1. **Dashboard**:
   - Big `FramebufferImage` of `currently_displayed_entry_id`.
   - Online/offline pill from `useSystemState`.
   - `system.flags` toggles (auto-discovered from referenced flag names — query all entries' conditions, surface a toggle per distinct `manual_flag.flag`).
   - "Lock to current" / "Unlock" buttons.
   - "No eligible candidates" warning if recent ticks logged it.
2. **Entries**:
   - Table with thumbnail (`FramebufferImage` scaled), title, source badge, enabled toggle, weight, conditions summary.
   - Row actions: edit (modal with title + enabled + weight + `ConditionsEditor`), `displayNow`, `lock`, delete (disabled for generator-owned with tooltip).
3. **Drafts**:
   - Table per [entry-drafts.md § Drafts list page](../entry-drafts.md#drafts-list-page).
   - Filter chips (active / consumed / expired / revoked).
   - Actions: copy URL, re-show QR, revoke.
4. **Generators**:
   - One tab per registered plugin.
   - Per tab: table of instances, "+ New" button, edit/delete/runNow.
   - Per-instance health card: last success, last failure.
5. **Settings**:
   - One form per `app_settings` key, validated against the same Zod schema (mirror it client-side, or expose via `settings.getAll`).
   - Group: palette, scheduling, display, generators-cadence.
6. **Diagnostics**:
   - Latest `/status` fields card.
   - Last N `push_log` rows table.
   - Last N `display_status_history` rows + small uptime sparkline.
   - Per-generator-instance run history.
   - Manual flag toggles (duplicated from dashboard for convenience).
   - "Push test pattern" button.
7. `ConditionsEditor`: form per condition type (`time_window`, `day_of_week`, `date_range`, `manual_flag`, `freshness`, `recently_updated`). Add/remove rows, AND-ed.
8. `FramebufferImage`: fetches bytes once per `entry.updated_at`, decodes to ImageData, paints to a `<canvas>`. CSS scaled.

## Acceptance

- Every admin page renders against a populated DB and exercises its tRPC procedures.
- Editing an entry's conditions persists correctly and the change is reflected on next tick.
- Toggling a flag visibly enables/disables entries that reference it.
- The dashboard updates online/offline within a couple of seconds of mock-display going down (SSE works).

## Notes

- The `[+]` button's modal is in step 19 alongside the editor route.
- This step is large; consider splitting per-page commits if the diff is unwieldy.
