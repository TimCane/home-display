# Editor

Two editors share a common rendering core: a desktop canvas tool and a simplified mobile editor. Both produce a 163,200-byte 2bpp framebuffer for storage; nothing else is retained. Re-editing requires re-creating from scratch.

## Shared pipeline

```
React state (in-memory layer model)
  → render to <canvas> at native 960×680
    → Floyd-Steinberg dither to 4-color palette
      → encode to 2bpp packed (163,200 bytes)
        → POST to backend
          → backend re-renders + dithers as source of truth
            → store framebuffer in DB
```

Both browser and backend run the **same** dither and encoding code (lives in `src/web/shared/`). Single TS module, imported by both. Browser dither is for live preview; backend dither is the canonical version that gets stored. This means the preview can drift from the actual stored frame if palette settings differ between sessions, but the stored frame is always correct because the backend re-runs the pipeline at commit time.

## Canvas

- Internal resolution is fixed at 960×680. CSS scales to fit the viewport.
- Backend: HTML `<canvas>` 2D context. No scene-graph library (no Konva, no Fabric).
- Layer model lives in React state — list of layer objects (`{type, position, rotation, props, z}`). Re-render = replay the list onto a fresh canvas.
- Layer model is throwaway: never persisted, never serialized, dies with the editing session.

## Desktop editor

Full canvas tool. Layout: canvas center, toolbox left, layers panel right.

Tools (V1):
- Image (paste, drop, file upload — auto-downscaled client-side to fit 960×680)
- Text (font, size, palette color)
- Rectangle (filled or outline, palette color)
- Line
- Circle
- Icon (Lucide icons; ~1,400 icons, search + categories picker)
- Background fill (one palette color as canvas backdrop)

Every element supports:
- Drag to position
- Resize handles
- **Rotate handle** (caveat: rotated edges dither poorly — see "Dither" below)

Editor features:
- Layers panel with click-to-select, drag-to-reorder, show/hide, delete
- Undo / redo (Cmd+Z / Cmd+Shift+Z)
- Snap-to-edge / snap-to-center alignment guides while dragging
- Dithered preview rendered live in a side panel (or toggle overlay on the canvas)
- Commit button → POST to backend → entry created

## Mobile editor

A deliberately reduced version for touch screens. Same dither/preview/commit pipeline; minimal authoring surface.

V1 capability:
- Pick an image (camera roll, file picker)
- Optional single text overlay (string + size + palette color)
- Live dithered preview
- Submit

No layers panel, no shapes, no rotation, no icons. The mobile editor and the guest submission page share most of their UI.

The desktop editor route shows "Use a larger screen for the full editor" on narrow viewports and offers the mobile editor as the alternative.

## Dither

- Algorithm: Floyd-Steinberg, error-diffused along scan rows.
- Always on. No per-image toggle in V1.
- Target palette: 4 RGB values from `app_settings.palette`, configured per-deployment.

### Caveats

- **Rotation + FS = jaggy edges.** FS error-diffuses along rows; rotated diagonals pick up scattered pixels along the boundary. Acceptable for decorative use; avoid for text-dense layouts.
- **Anti-aliased text and QR-style sharp lines** dither into noisy boundaries. The pre-dither rasterizer should keep these layers crisp where possible.
- **Preview-vs-actual divergence** is bounded by palette drift. The backend always re-dithers with the canonical palette before storage, so the displayed image is always self-consistent — only the in-browser preview can lie.

## Palette calibration

Stored in `app_settings.palette`. Editable from the admin config page without redeploy.

Calibration loop:
1. From the diagnostics page, push a 4-quadrant test pattern (solid black/white/yellow/red).
2. Photograph the panel.
3. Color-pick the actual hex values from the photo.
4. Update `app_settings.palette` via the admin UI. The change applies immediately to all subsequent backend re-renders. The browser preview picks up the new values on next page load.

A miscalibrated palette only affects preview accuracy and dither quality — never panel correctness.

## Fonts

Bundled with the frontend, served by the backend, also available to the backend canvas renderer for re-render at commit. Two categories:

- 2–3 standard web fonts (e.g. Inter, JetBrains Mono, a heavy display face)
- 1–2 bitmap / pixel fonts tuned for low-res rendering on e-paper

System fonts (`sans-serif`, `monospace`) are not used — they vary across machines and would make the backend re-render non-deterministic.

## Render-from-framebuffer (admin "current display" view)

To show what's currently on the panel — or what any stored entry looks like — the browser fetches the raw 163,200 bytes and decodes them client-side: unpack 2bpp into 4 indices per byte, paint each pixel with the matching palette color into a `<canvas>`. Same code is used for entry list thumbnails (full resolution scaled in CSS).
