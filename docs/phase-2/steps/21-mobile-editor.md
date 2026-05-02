# Step 21 — Mobile editor

## Goal

Reduced-surface editor for narrow viewports per [editor.md § Mobile editor](../editor.md#mobile-editor): pick image, optional single text overlay, dithered preview, submit. Shares the same commit pipeline as the desktop variant.

## Depends on

Steps 6, 19.

## Files

- `src/web/client/editor/mobile/MobileEditor.tsx`
- `src/web/client/editor/mobile/ImagePicker.tsx`
- `src/web/client/editor/mobile/TextOverlay.tsx`
- `src/web/client/editor/mobile/Preview.tsx`
- `src/web/client/editor/mobile/state.ts` — minimal `{image, text}` model

## Tasks

1. `ImagePicker`:
   - `<input type="file" accept="image/*" capture="environment">` for camera-roll + camera.
   - Decode (`createImageBitmap`) and downscale to fit 960×680.
2. `TextOverlay` (optional, only if `allowed_elements` includes `text`):
   - Single text input, size slider, palette color picker.
   - Position fixed (e.g. lower third) — no dragging in V1.
3. `Preview`:
   - Composite image + optional text on a 960×680 offscreen canvas.
   - Run shared `dither` → repaint preview canvas at fitted size.
4. Submit:
   - Produce 163,200-byte buffer → call `EditorShell`'s commit handler.
5. Respect `draft.guest_mode` and `allowed_elements`:
   - If `image_upload` only → text overlay hidden.
   - If text included → both available.

## Acceptance

- On a phone-width viewport (or DevTools mobile preset), pick an image, see the dithered preview, submit, and the entry lands in `entries`.
- With `allowed_elements = ['image_upload']`, the text overlay UI is absent.

## Notes

- No layers, no rotation, no shapes, no icons. By design.
- File-format limits (20 MB, JPEG/PNG/WebP/HEIC) are enforced both client-side and by the commit endpoint from step 14.
