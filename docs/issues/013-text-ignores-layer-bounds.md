# 013 — Text expands outside selection area and resizing doesn't change font size

**Type:** Bug
**Severity:** High

## Problem

When adding a text layer in the editor, the rendered text ignores the layer's bounding box:

1. **Text overflows** — typing text that is longer than the selection area causes it to render outside the bounds, since `fillText` draws in a single line with no wrapping or clipping.
2. **Resizing does nothing** — dragging the selection handles changes `layer.width` / `layer.height`, but the text renderer only uses `layer.fontSize` (a separate fixed property), so the text stays the same size.

Users expect text to stay within its bounding box and to scale when the box is resized.

## Where

- `src/web/client/editor/desktop/layers/render.ts:67-72` — text rendering ignores `layer.width` and `layer.height`
- `src/web/client/editor/desktop/state/types.ts:31-37` — `TextLayer` has both `fontSize` and `width`/`height` but they are independent

## Fix

Two approaches (not mutually exclusive):

1. **Auto-fit font size to bounds** — when the layer is resized, recalculate `fontSize` so the text fits within `width × height`. Use `ctx.measureText()` to measure the text at a trial size, then scale proportionally. This makes resizing the box resize the text.

2. **Word-wrap and clip** — split text into lines that fit within `layer.width`, and clip or stop rendering at `layer.height`. This prevents overflow for multi-word text.

Option 1 is the more intuitive behaviour for a design tool — resizing the box should resize the text. Option 2 is a useful addition for longer text blocks. Both could be combined: wrap text within the box width, then scale `fontSize` down if the wrapped text exceeds the box height.
