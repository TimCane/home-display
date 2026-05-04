# 008 — Entry preview too big on entries page

**Type:** Bug
**Severity:** Medium

## Problem

The framebuffer preview thumbnails on the Entries list page are too large, making the table unwieldy.

## Where

- `src/web/client/pages/EntriesPage.tsx` — entries table
- `src/web/client/components/FramebufferImage.tsx` — preview component

## Fix

Scale the preview down to a small thumbnail size (e.g. ~120px wide) in the entries table. The `FramebufferImage` component renders at full 960x680 resolution and relies on CSS scaling — either pass a smaller explicit size prop or constrain it with a max-width/height in the table cell.
