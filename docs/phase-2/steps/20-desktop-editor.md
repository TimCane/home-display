# Step 20 — Desktop editor

## Goal

Full-fidelity canvas editor per [editor.md § Desktop editor](../editor.md#desktop-editor): tools, layers, undo/redo, snap guides, live dither preview. Submits a 163,200-byte frame to the commit pipeline from step 19.

## Depends on

Steps 6, 19.

## Files

- `src/web/client/editor/desktop/DesktopEditor.tsx` — orchestrator
- `src/web/client/editor/desktop/Canvas.tsx` — 960×680 canvas, render loop
- `src/web/client/editor/desktop/Toolbox.tsx` — tool buttons
- `src/web/client/editor/desktop/LayersPanel.tsx`
- `src/web/client/editor/desktop/PreviewPanel.tsx` — dithered preview
- `src/web/client/editor/desktop/layers/` — layer types: `image`, `text`, `rect`, `line`, `circle`, `icon`, `background`
- `src/web/client/editor/desktop/state/` — Zustand store (or Reducer) for the layer model + history
- `src/web/client/editor/desktop/snapping.ts` — alignment guides
- Bundled fonts in `src/web/client/assets/fonts/`

## Tasks

1. Layer model:
   - Discriminated union of layer types, each with `{id, type, position, rotation, props, z}`.
   - Editor state: `{layers, selectedId, palette, history}`.
   - Undo/redo via history snapshots on every committed mutation; Cmd+Z / Cmd+Shift+Z.
2. Canvas render loop:
   - On any state change, redraw the 960×680 canvas from layers in `z` order (background first).
   - Use Canvas 2D API directly. No scene-graph lib.
   - Selection box + handles overlay drawn after layer pass.
3. Tools (one per layer type):
   - Image: file picker, paste, drag-drop. Auto-downscale to fit.
   - Text: font (from bundled fonts only), size, palette color.
   - Rect: filled or outline.
   - Line, Circle: same idea.
   - Icon: Lucide picker (search + categories), monochromatic via palette color.
   - Background: single palette color filling the canvas.
4. Per-layer interactions:
   - Drag to position.
   - Resize handles.
   - Rotate handle (with the dithering caveat called out in [editor.md § Caveats](../editor.md#caveats)).
5. Snap guides:
   - During drag, compute snap points (canvas edges, center, other layers' edges/centers).
   - Within a few px → snap + draw a guide line.
6. Layers panel:
   - Listed top → bottom in z descending.
   - Click → select. Drag → reorder. Eye → show/hide. Trash → delete.
7. Preview panel:
   - Toggle: side-by-side or overlay.
   - Pipeline: render layers to an offscreen canvas → `getImageData` → shared `dither` → repaint preview canvas with palette colors per index.
   - Apply `allowed_elements` filter when `draft.guest_mode` is set (some tool buttons hidden).
8. Commit:
   - On Commit → produce final 163,200-byte buffer via shared pipeline → call into `EditorShell`'s commit handler from step 19.

## Acceptance

- Build a multi-layer composition (background + image + text + icon), commit, and see the resulting `entries` row appear with a frame that decodes back recognizably.
- Undo/redo works across at least 20 mutations.
- Snap-to-center / snap-to-edge fires within a few px and renders a visible guide.
- A guest draft with `allowed_elements = ['image_upload']` shows only the image tool.

## Notes

- Bitmap fonts at small sizes will dither cleanly; AA web fonts will not — the preview makes this obvious.
- This step is the largest in the build. Land smaller commits per tool family if convenient.
