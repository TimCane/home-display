/**
 * Quote "daily" renderer.
 * Clean typographic layout with decorative quote marks.
 */

import type { QuoteData } from "../fetch.js";
import {
  createFrame,
  loadPalette,
  canvasToFramebuffer,
  DISPLAY_FONT,
  BLACK, WHITE, YELLOW,
} from "../../render-utils.js";
import { WIDTH, HEIGHT } from "../../../../shared/framebuffer.js";

/**
 * Word-wrap text to fit within maxWidth, returning an array of lines.
 */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export async function renderDaily(data: QuoteData): Promise<Uint8Array> {
  const palette = await loadPalette();
  const canvas = createFrame();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ctx = canvas.getContext("2d") as any;

  // ── Background ──
  ctx.fillStyle = WHITE;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // ── Determine font size based on quote length ──
  const len = data.text.length;
  let fontSize: number;
  if (len < 80) {
    fontSize = 36;
  } else if (len <= 200) {
    fontSize = 28;
  } else {
    fontSize = 22;
  }

  const marginX = 80;
  const maxTextWidth = WIDTH - marginX * 2;
  const lineHeight = fontSize * 1.5;

  // ── Decorative opening quote mark ──
  ctx.fillStyle = YELLOW;
  ctx.font = `bold 120px ${DISPLAY_FONT}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText("\u201C", marginX - 30, 40);

  // ── Measure and wrap quote text ──
  ctx.font = `bold ${fontSize}px ${DISPLAY_FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  const lines = wrapText(ctx, data.text, maxTextWidth);

  // Vertically centre the quote block within the canvas
  const blockHeight = lines.length * lineHeight;
  const startY = (HEIGHT - blockHeight) / 2 - 20; // nudge up slightly for divider + author

  ctx.fillStyle = BLACK;
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], WIDTH / 2, startY + i * lineHeight);
  }

  // ── Yellow divider ──
  const dividerY = startY + blockHeight + 24;
  const dividerWidth = 80;
  ctx.fillStyle = YELLOW;
  ctx.fillRect(WIDTH / 2 - dividerWidth / 2, dividerY, dividerWidth, 4);

  // ── Author ──
  ctx.fillStyle = BLACK;
  ctx.font = `${Math.max(18, fontSize - 6)}px ${DISPLAY_FONT}`;
  ctx.textAlign = "right";
  ctx.textBaseline = "top";
  ctx.fillText(`\u2014 ${data.author}`, WIDTH - marginX, dividerY + 20);

  // ── Decorative closing quote mark ──
  ctx.fillStyle = YELLOW;
  ctx.font = `bold 120px ${DISPLAY_FONT}`;
  ctx.textAlign = "right";
  ctx.textBaseline = "bottom";
  ctx.fillText("\u201D", WIDTH - marginX + 30, HEIGHT - 40);

  return canvasToFramebuffer(canvas, palette);
}
