/**
 * 2bpp framebuffer encode/decode matching the firmware wire format.
 *
 * Each byte packs 4 palette indices (0-3), MSB-first:
 *   byte = (idx0 << 6) | (idx1 << 4) | (idx2 << 2) | idx3
 *
 * Total: 960 x 680 = 652,800 pixels / 4 = 163,200 bytes.
 */

export const WIDTH = 960;
export const HEIGHT = 680;
export const TOTAL_PIXELS = WIDTH * HEIGHT; // 652,800
export const FRAME_BYTES = TOTAL_PIXELS / 4; // 163,200

/**
 * Pack an array of palette indices (0-3) into 2bpp bytes, MSB-first.
 * @param indices - Uint8Array of length 652,800 with values 0-3
 * @returns Uint8Array of length 163,200
 */
export function encode2bpp(indices: Uint8Array): Uint8Array {
  if (indices.length !== TOTAL_PIXELS) {
    throw new RangeError(
      `encode2bpp: expected ${TOTAL_PIXELS} indices, got ${indices.length}`,
    );
  }

  const out = new Uint8Array(FRAME_BYTES);
  for (let i = 0; i < FRAME_BYTES; i++) {
    const base = i * 4;
    out[i] =
      ((indices[base] & 0x03) << 6) |
      ((indices[base + 1] & 0x03) << 4) |
      ((indices[base + 2] & 0x03) << 2) |
      (indices[base + 3] & 0x03);
  }
  return out;
}

/**
 * Unpack 2bpp bytes back to palette indices, MSB-first.
 * @param bytes - Uint8Array of length 163,200
 * @returns Uint8Array of length 652,800 with values 0-3
 */
export function decode2bpp(bytes: Uint8Array): Uint8Array {
  if (bytes.length !== FRAME_BYTES) {
    throw new RangeError(
      `decode2bpp: expected ${FRAME_BYTES} bytes, got ${bytes.length}`,
    );
  }

  const out = new Uint8Array(TOTAL_PIXELS);
  for (let i = 0; i < FRAME_BYTES; i++) {
    const base = i * 4;
    const b = bytes[i];
    out[base] = (b >> 6) & 0x03;
    out[base + 1] = (b >> 4) & 0x03;
    out[base + 2] = (b >> 2) & 0x03;
    out[base + 3] = b & 0x03;
  }
  return out;
}
