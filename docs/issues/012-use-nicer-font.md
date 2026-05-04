# 012 — Use a nicer font

**Type:** Improvement
**Priority:** Medium

## Problem

All server-side generator renderers and the canvas editor hardcode `sans-serif` as the font family. This falls back to whatever the OS default is, which on the server (Node/Docker) is typically DejaVu Sans or a similarly plain system font. The result looks generic and unpolished on the e-ink display.

The web UI (`index.css`) similarly uses `system-ui, -apple-system, sans-serif`.

## Where

Generator renderers (every `ctx.font = "... sans-serif"` line):
- `src/web/server/generators/calendar/renderers/today-tomorrow.ts`
- `src/web/server/generators/calendar/renderers/5day.ts`
- `src/web/server/generators/weather/renderers/today.ts`
- `src/web/server/generators/weather/renderers/5day.ts`
- `src/web/server/generators/render-utils.ts`

Canvas editor:
- `src/web/client/editor/desktop/Toolbox.tsx:139` — default `fontFamily` for new text layers
- `src/web/client/editor/desktop/layers/render.ts:69` — renders text with layer's `fontFamily`

Web UI:
- `src/web/client/index.css:76`

## Fix

1. **Pick a font** — choose a clean, readable font that works well at e-ink resolution (typically 800×480). Good candidates: Inter, Roboto, Nunito, or Source Sans Pro.

2. **Register with node-canvas** — use `registerFont()` from `canvas` to load the `.ttf`/`.otf` file at server startup so the font is available to all `CanvasRenderingContext2D` calls.

3. **Bundle the font file** — add the font to a `src/web/server/fonts/` directory (or similar) and ensure it's included in the Docker image.

4. **Define a shared constant** — replace the scattered `"sans-serif"` strings with a single constant (e.g. `DISPLAY_FONT`) so the font name is easy to change later.

5. **Update the web UI** — load the same font via `@font-face` in `index.css` so the preview matches the rendered output.
