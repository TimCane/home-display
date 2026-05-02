/**
 * Generate golden-frame test fixtures.
 *
 * Run with: npx tsx test/web/generate-fixtures.ts
 *
 * Produces PNGs and their expected .bin (2bpp) outputs in test/web/fixtures/.
 * Three shapes: decorative (solid colour blocks), text (black-on-white pattern),
 * photo (smooth gradient).
 */

import sharp from "sharp";
import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { dither } from "../../src/web/shared/dither.js";
import { DEFAULT_PALETTE, type Palette } from "../../src/web/shared/palette.js";
import { WIDTH, HEIGHT } from "../../src/web/shared/framebuffer.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(__dirname, "fixtures");

async function generateDecorative(palette: Palette): Promise<void> {
  // 4 vertical stripes, one per palette colour
  const rgba = new Uint8Array(WIDTH * HEIGHT * 4);
  const stripeW = WIDTH / 4;

  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const idx = (y * WIDTH + x) * 4;
      const stripe = Math.min(3, Math.floor(x / stripeW));
      const c = palette[stripe];
      rgba[idx] = c.r;
      rgba[idx + 1] = c.g;
      rgba[idx + 2] = c.b;
      rgba[idx + 3] = 255;
    }
  }

  await sharp(Buffer.from(rgba.buffer), {
    raw: { width: WIDTH, height: HEIGHT, channels: 4 },
  })
    .png()
    .toFile(resolve(FIXTURES, "decorative.png"));

  const bin = dither(rgba, WIDTH, HEIGHT, palette);
  writeFileSync(resolve(FIXTURES, "decorative.bin"), bin);
  console.log("decorative: done");
}

async function generateText(palette: Palette): Promise<void> {
  // Black text-like pattern on white: checkerboard blocks simulating text
  const rgba = new Uint8Array(WIDTH * HEIGHT * 4);
  const white = palette[1]; // white
  const black = palette[0]; // black

  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const idx = (y * WIDTH + x) * 4;
      // Simulate text lines: alternating 20px bands, with black blocks in text rows
      const inTextRow = Math.floor(y / 20) % 2 === 0;
      const inCharBlock = Math.floor(x / 12) % 3 !== 0; // gaps between "chars"
      const isBlack = inTextRow && inCharBlock && y % 20 < 14;
      const c = isBlack ? black : white;
      rgba[idx] = c.r;
      rgba[idx + 1] = c.g;
      rgba[idx + 2] = c.b;
      rgba[idx + 3] = 255;
    }
  }

  await sharp(Buffer.from(rgba.buffer), {
    raw: { width: WIDTH, height: HEIGHT, channels: 4 },
  })
    .png()
    .toFile(resolve(FIXTURES, "text.png"));

  const bin = dither(rgba, WIDTH, HEIGHT, palette);
  writeFileSync(resolve(FIXTURES, "text.bin"), bin);
  console.log("text: done");
}

async function generatePhoto(palette: Palette): Promise<void> {
  // Smooth diagonal gradient across all channels — exercises dither diffusion
  const rgba = new Uint8Array(WIDTH * HEIGHT * 4);

  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const idx = (y * WIDTH + x) * 4;
      const t = (x / WIDTH + y / HEIGHT) / 2; // 0..1 diagonal
      rgba[idx] = Math.round(t * 255);
      rgba[idx + 1] = Math.round((1 - t) * 128);
      rgba[idx + 2] = Math.round(Math.sin(t * Math.PI) * 200);
      rgba[idx + 3] = 255;
    }
  }

  await sharp(Buffer.from(rgba.buffer), {
    raw: { width: WIDTH, height: HEIGHT, channels: 4 },
  })
    .png()
    .toFile(resolve(FIXTURES, "photo.png"));

  const bin = dither(rgba, WIDTH, HEIGHT, palette);
  writeFileSync(resolve(FIXTURES, "photo.bin"), bin);
  console.log("photo: done");
}

async function main() {
  await generateDecorative(DEFAULT_PALETTE);
  await generateText(DEFAULT_PALETTE);
  await generatePhoto(DEFAULT_PALETTE);
  console.log("All fixtures generated.");
}

main().catch(console.error);
