import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

import { dither } from "../../src/web/shared/dither.js";
import { DEFAULT_PALETTE, type Palette } from "../../src/web/shared/palette.js";
import { WIDTH, HEIGHT, FRAME_BYTES, decode2bpp } from "../../src/web/shared/framebuffer.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(__dirname, "fixtures");

async function loadPng(name: string): Promise<Uint8Array> {
  const { data } = await sharp(resolve(FIXTURES, name))
    .raw()
    .ensureAlpha()
    .toBuffer({ resolveWithObject: true });
  return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
}

function loadBin(name: string): Uint8Array {
  const buf = readFileSync(resolve(FIXTURES, name));
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
}

describe("golden-frame tests", () => {
  it("decorative: solid colour stripes match golden .bin", async () => {
    const rgba = await loadPng("decorative.png");
    const result = dither(rgba, WIDTH, HEIGHT, DEFAULT_PALETTE);
    const expected = loadBin("decorative.bin");
    expect(result.length).toBe(FRAME_BYTES);
    expect(Buffer.from(result).equals(Buffer.from(expected))).toBe(true);
  });

  it("text: black-on-white pattern matches golden .bin", async () => {
    const rgba = await loadPng("text.png");
    const result = dither(rgba, WIDTH, HEIGHT, DEFAULT_PALETTE);
    const expected = loadBin("text.bin");
    expect(result.length).toBe(FRAME_BYTES);
    expect(Buffer.from(result).equals(Buffer.from(expected))).toBe(true);
  });

  it("photo: gradient matches golden .bin", async () => {
    const rgba = await loadPng("photo.png");
    const result = dither(rgba, WIDTH, HEIGHT, DEFAULT_PALETTE);
    const expected = loadBin("photo.bin");
    expect(result.length).toBe(FRAME_BYTES);
    expect(Buffer.from(result).equals(Buffer.from(expected))).toBe(true);
  });
});

describe("dither output properties", () => {
  it("output is always FRAME_BYTES long", async () => {
    const rgba = new Uint8Array(WIDTH * HEIGHT * 4).fill(128);
    // Set alpha to 255
    for (let i = 3; i < rgba.length; i += 4) rgba[i] = 255;
    const result = dither(rgba, WIDTH, HEIGHT, DEFAULT_PALETTE);
    expect(result.length).toBe(FRAME_BYTES);
  });

  it("all-black input produces only index 0", () => {
    const rgba = new Uint8Array(WIDTH * HEIGHT * 4);
    for (let i = 0; i < rgba.length; i += 4) {
      rgba[i] = 0;
      rgba[i + 1] = 0;
      rgba[i + 2] = 0;
      rgba[i + 3] = 255;
    }
    const result = dither(rgba, WIDTH, HEIGHT, DEFAULT_PALETTE);
    const indices = decode2bpp(result);
    expect(indices.every((idx) => idx === 0)).toBe(true);
  });

  it("all-white input produces only index 1", () => {
    const rgba = new Uint8Array(WIDTH * HEIGHT * 4);
    for (let i = 0; i < rgba.length; i += 4) {
      rgba[i] = 255;
      rgba[i + 1] = 255;
      rgba[i + 2] = 255;
      rgba[i + 3] = 255;
    }
    const result = dither(rgba, WIDTH, HEIGHT, DEFAULT_PALETTE);
    const indices = decode2bpp(result);
    expect(indices.every((idx) => idx === 1)).toBe(true);
  });

  it("throws on wrong dimensions", () => {
    expect(() =>
      dither(new Uint8Array(100 * 100 * 4), 100, 100, DEFAULT_PALETTE),
    ).toThrow(RangeError);
  });
});
