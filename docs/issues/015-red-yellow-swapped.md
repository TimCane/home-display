# 015 — Red and yellow colours are swapped on the display

**Type:** Bug
**Severity:** High

## Problem

Colours that should be red appear yellow on the e-paper display, and vice versa.

The palette definition assigns:
- Index 2 → red
- Index 3 → yellow

But the wire format (which the SSD2677 consumes directly) maps:
- Bits `10` (= index 2) → **yellow**
- Bits `11` (= index 3) → **red**

`encode2bpp` in `framebuffer.ts` writes palette indices as raw 2-bit values with no remapping, so index 2 is sent as bits `10` which the panel renders as yellow — the opposite of what was intended.

The web preview looks correct (it reads indices back through `DEFAULT_PALETTE`), but the physical display has them flipped.

## Where

- `src/web/shared/palette.ts:17-22` — index 2 = red, index 3 = yellow
- `docs/wire-format.md:12-19` — bits `10` = yellow, bits `11` = red
- `src/web/shared/framebuffer.ts:20-37` — `encode2bpp` writes indices as-is, no remap
- `src/firmware/display/epd.cpp:67-84` — SSD2677 LUT init (defines what bits `10`/`11` mean on the panel)

## Fix

Swap the palette indices so they match the wire format:

In `palette.ts`, change to:
```ts
export const DEFAULT_PALETTE: Palette = [
  { r: 0, g: 0, b: 0 },       // 0 — black
  { r: 255, g: 255, b: 255 },  // 1 — white
  { r: 255, g: 255, b: 0 },    // 2 — yellow  (bits 10)
  { r: 200, g: 0, b: 0 },      // 3 — red     (bits 11)
];
```

Also update `render-utils.ts:loadPalette()` which currently returns `[black, white, red, yellow]` — swap to `[black, white, yellow, red]`.

Update the palette settings schema default ordering and any UI labels that reference colour indices (e.g. colour picker swatches) to match.

Alternatively, fix the firmware LUT so bits `10` = red and `11` = yellow, but changing the software palette is simpler and doesn't require a firmware flash.
