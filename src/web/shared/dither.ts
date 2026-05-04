/**
 * Floyd-Steinberg dithering with canonical weights.
 *
 * Takes raw RGBA pixel data and a 4-colour palette, returns a packed 2bpp
 * framebuffer ready for the firmware.
 */

import { type Palette, nearestColorIndex } from "./palette.js";
import { WIDTH, HEIGHT, TOTAL_PIXELS, FRAME_BYTES, encode2bpp } from "./framebuffer.js";

/**
 * Dither RGBA image data to 2bpp framebuffer bytes.
 *
 * @param rgba   - RGBA pixel data (width * height * 4 bytes)
 * @param width  - Image width (must be 960)
 * @param height - Image height (must be 680)
 * @param palette - 4-colour palette
 * @returns 2bpp-encoded framebuffer (163,200 bytes)
 */
export function dither(
  rgba: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  palette: Palette,
): Uint8Array {
  if (width !== WIDTH || height !== HEIGHT) {
    throw new RangeError(
      `dither: expected ${WIDTH}x${HEIGHT}, got ${width}x${height}`,
    );
  }
  if (rgba.length !== TOTAL_PIXELS * 4) {
    throw new RangeError(
      `dither: expected ${TOTAL_PIXELS * 4} RGBA bytes, got ${rgba.length}`,
    );
  }

  // Work in signed floats for error diffusion
  const r = new Float32Array(TOTAL_PIXELS);
  const g = new Float32Array(TOTAL_PIXELS);
  const b = new Float32Array(TOTAL_PIXELS);

  for (let i = 0; i < TOTAL_PIXELS; i++) {
    const off = i * 4;
    r[i] = rgba[off];
    g[i] = rgba[off + 1];
    b[i] = rgba[off + 2];
    // Alpha channel ignored — treat as opaque
  }

  const indices = new Uint8Array(TOTAL_PIXELS);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;

      // Clamp to [0, 255]
      const cr = Math.max(0, Math.min(255, r[idx]));
      const cg = Math.max(0, Math.min(255, g[idx]));
      const cb = Math.max(0, Math.min(255, b[idx]));

      const paletteIdx = nearestColorIndex(cr, cg, cb, palette);
      indices[idx] = paletteIdx;

      const chosen = palette[paletteIdx];
      const errR = cr - chosen.r;
      const errG = cg - chosen.g;
      const errB = cb - chosen.b;

      // Floyd-Steinberg error diffusion (scan-row order):
      //          * 7/16
      //   3/16 5/16 1/16

      if (x + 1 < width) {
        const ri = idx + 1;
        r[ri] += errR * (7 / 16);
        g[ri] += errG * (7 / 16);
        b[ri] += errB * (7 / 16);
      }
      if (y + 1 < height) {
        if (x - 1 >= 0) {
          const ri = idx + width - 1;
          r[ri] += errR * (3 / 16);
          g[ri] += errG * (3 / 16);
          b[ri] += errB * (3 / 16);
        }
        {
          const ri = idx + width;
          r[ri] += errR * (5 / 16);
          g[ri] += errG * (5 / 16);
          b[ri] += errB * (5 / 16);
        }
        if (x + 1 < width) {
          const ri = idx + width + 1;
          r[ri] += errR * (1 / 16);
          g[ri] += errG * (1 / 16);
          b[ri] += errB * (1 / 16);
        }
      }
    }
  }

  return encode2bpp(indices);
}
