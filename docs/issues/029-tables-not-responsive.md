# 029 — Entry and draft tables overflow on mobile

**Type:** Improvement
**Priority:** Low

## Problem

The Entries and Drafts pages use wide tables (6-8 columns) wrapped in `overflow-x-auto`. On mobile and narrow viewports, users must scroll horizontally, which is awkward and easy to miss.

## Where

- `src/web/client/pages/EntriesPage.tsx:86-122` — 8-column table
- `src/web/client/pages/DraftsPage.tsx:81-158` — 6-column table

## Fix

Options:

1. **Card layout on mobile** — switch from a table to stacked cards below a breakpoint (e.g. `md:`). Each card shows the entry's key fields vertically.
2. **Hide columns** — use responsive classes to hide lower-priority columns (e.g. conditions, show count) on small screens.
3. **Both** — cards on mobile, full table on desktop.
