import { describe, it, expect } from "vitest";
import {
  encode2bpp,
  decode2bpp,
  WIDTH,
  HEIGHT,
  TOTAL_PIXELS,
  FRAME_BYTES,
} from "../../src/web/shared/framebuffer.js";

describe("framebuffer constants", () => {
  it("has correct dimensions", () => {
    expect(WIDTH).toBe(960);
    expect(HEIGHT).toBe(680);
    expect(TOTAL_PIXELS).toBe(652_800);
    expect(FRAME_BYTES).toBe(163_200);
  });
});

describe("encode2bpp", () => {
  it("packs 4 indices per byte, MSB-first", () => {
    const indices = new Uint8Array(TOTAL_PIXELS);
    // First 4 pixels: 0, 1, 2, 3
    indices[0] = 0;
    indices[1] = 1;
    indices[2] = 2;
    indices[3] = 3;
    const encoded = encode2bpp(indices);
    // 0b_00_01_10_11 = 0x1B
    expect(encoded[0]).toBe(0x1b);
  });

  it("all-zero indices produce all-zero bytes", () => {
    const indices = new Uint8Array(TOTAL_PIXELS); // default 0
    const encoded = encode2bpp(indices);
    expect(encoded.length).toBe(FRAME_BYTES);
    expect(encoded.every((b) => b === 0)).toBe(true);
  });

  it("all-three indices produce 0xFF bytes", () => {
    const indices = new Uint8Array(TOTAL_PIXELS).fill(3);
    const encoded = encode2bpp(indices);
    expect(encoded.every((b) => b === 0xff)).toBe(true);
  });

  it("throws on wrong size", () => {
    expect(() => encode2bpp(new Uint8Array(100))).toThrow(RangeError);
  });
});

describe("decode2bpp", () => {
  it("is the inverse of encode2bpp", () => {
    const indices = new Uint8Array(TOTAL_PIXELS);
    for (let i = 0; i < TOTAL_PIXELS; i++) {
      indices[i] = i % 4;
    }
    const roundtripped = decode2bpp(encode2bpp(indices));
    expect(roundtripped).toEqual(indices);
  });

  it("throws on wrong size", () => {
    expect(() => decode2bpp(new Uint8Array(100))).toThrow(RangeError);
  });
});

describe("row stride", () => {
  it("each row is WIDTH/4 bytes — no padding or off-by-one", () => {
    const indices = new Uint8Array(TOTAL_PIXELS);
    // Set first pixel of each row to index 3, rest 0
    for (let y = 0; y < HEIGHT; y++) {
      indices[y * WIDTH] = 3;
    }
    const encoded = encode2bpp(indices);
    const bytesPerRow = WIDTH / 4; // 240

    for (let y = 0; y < HEIGHT; y++) {
      // First byte of each row should have index 3 in the MSB position
      // 0b_11_00_00_00 = 0xC0
      expect(encoded[y * bytesPerRow]).toBe(0xc0);
      // Rest of the row should be 0
      for (let b = 1; b < bytesPerRow; b++) {
        expect(encoded[y * bytesPerRow + b]).toBe(0);
      }
    }
  });
});
