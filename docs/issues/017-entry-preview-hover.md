# 017 — Hover to enlarge entry framebuffer preview on entries page

**Type:** Improvement
**Priority:** Low

## Problem

The entries table thumbnails are small (120px wide, per issue 008 fix) which is good for table layout, but makes it hard to see detail. There's no way to quickly preview an entry at a larger size without navigating away.

## Where

- `src/web/client/pages/EntriesPage.tsx:166-170` — `FramebufferImage` rendered at `w-[120px]` in the table row

## Fix

Add a hover popover/tooltip that shows the framebuffer at a larger size (e.g. 480px wide) when the user hovers over the thumbnail. Options:

1. **CSS-only approach** — wrap the thumbnail in a `group` container and use a sibling/child element with `hidden group-hover:block` that renders a larger version positioned with `absolute`. Simple, no extra dependencies.

2. **Popover component** — use a small popover/tooltip component triggered on hover, positioned near the thumbnail. Keeps the enlarged preview from clipping against the table edges.

Either way, reuse the existing `FramebufferImage` component with a larger `className` for the hover version. No new data fetching needed — same `entryId` and `updatedAt` props, just a wider render.
