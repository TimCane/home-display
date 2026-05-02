# Step 6 — Shared core + golden-frame tests

## Goal

Land the byte-correct surface that both client and server depend on: palette, framebuffer 2bpp encode/decode, Floyd-Steinberg dither, and condition Zod schemas + evaluators. Backed by Vitest unit tests with golden frames.

## Depends on

Step 3 (TS toolchain).

## Files

- `src/web/shared/palette.ts` — palette type + helpers (nearest-color lookup)
- `src/web/shared/framebuffer.ts` — 2bpp pack/unpack, `FRAME_BYTES = 163200`, `WIDTH = 960`, `HEIGHT = 680`
- `src/web/shared/dither.ts` — Floyd-Steinberg, takes RGBA image data + palette → 2bpp bytes
- `src/web/shared/conditions.ts` — Zod schema for the `conditions` JSONB shape; pure evaluator functions per type
- `test/web/dither.test.ts`, `test/web/framebuffer.test.ts`, `test/web/conditions.test.ts`
- `test/web/fixtures/` — golden input PNGs + expected `.bin` outputs

## Tasks

1. Install `vitest`, `zod`, an image decoder (e.g. `sharp` for the test harness).
2. Implement `framebuffer.ts`:
   - `encode2bpp(indices: Uint8Array): Uint8Array` — 4 indices/byte, MSB-first per the firmware contract in [../../wire-format.md](../../wire-format.md).
   - `decode2bpp(bytes: Uint8Array): Uint8Array` — inverse, returning palette indices.
   - Throw on wrong sizes.
3. Implement `dither.ts`:
   - Pure function: `(rgba, width, height, palette) → Uint8Array<163200>`.
   - Floyd-Steinberg with the canonical 7/16, 3/16, 5/16, 1/16 weights, scan-row order.
4. Implement `conditions.ts`:
   - Zod discriminated union over the 6 condition types in [scheduler.md § Conditions](../scheduler.md#conditions).
   - Per-type evaluator: `(condition, ctx: {now, tz, entry, flags}) → boolean`.
   - `evaluateAll(conditions, ctx) → boolean` (AND).
5. Tests:
   - Golden frames: render a known PNG → dither → encode → byte-match the committed `.bin`.
   - Edge palettes (all-black, all-white).
   - Off-by-one row stride checks.
   - Condition evaluators across timezones (DST boundary cases for `time_window`).

## Acceptance

- `pnpm test` passes with at least one golden-frame test per renderer-shape (decorative / text / photo).
- `pnpm typecheck` passes.
- Code in `src/web/shared/` has no Node-only or browser-only imports — runs in both.

## Notes

- This module is referenced by [editor.md § Shared pipeline](../editor.md#shared-pipeline) and is what guarantees client and server can't drift.
- Generators (step 16) will reuse `dither.ts` server-side.
