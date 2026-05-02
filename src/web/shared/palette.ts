/**
 * Palette definition for the e-paper display.
 * The display supports 4 colours indexed 0-3.
 * Actual RGB values are calibrated per-panel and stored in app_settings;
 * these defaults match the SSD2677 typical output.
 */

export interface PaletteColor {
  r: number;
  g: number;
  b: number;
}

export type Palette = [PaletteColor, PaletteColor, PaletteColor, PaletteColor];

/** Default palette — black / white / red / yellow (typical 4-colour e-paper). */
export const DEFAULT_PALETTE: Palette = [
  { r: 0, g: 0, b: 0 }, // 0 — black
  { r: 255, g: 255, b: 255 }, // 1 — white
  { r: 200, g: 0, b: 0 }, // 2 — red
  { r: 255, g: 255, b: 0 }, // 3 — yellow
];

/** Squared Euclidean distance in RGB space. */
function distSq(a: PaletteColor, b: PaletteColor): number {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return dr * dr + dg * dg + db * db;
}

/** Return the palette index (0-3) closest to the given RGB colour. */
export function nearestColorIndex(
  r: number,
  g: number,
  b: number,
  palette: Palette,
): number {
  const c: PaletteColor = { r, g, b };
  let bestIdx = 0;
  let bestDist = distSq(c, palette[0]);
  for (let i = 1; i < 4; i++) {
    const d = distSq(c, palette[i]);
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }
  return bestIdx;
}
