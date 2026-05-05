/**
 * "Word of the Day" daily renderer — dictionary card layout.
 */

import type { WordData } from "../fetch.js";
import type { SKRSContext2D } from "@napi-rs/canvas";
import {
  createFrame,
  loadPalette,
  canvasToFramebuffer,
  drawHeaderBar,
  BLACK,
  WHITE,
  YELLOW,
  RED,
} from "../../render-utils.js";
import { WIDTH, HEIGHT } from "../../../../shared/framebuffer.js";

/* ── Helpers ────────────────────────────────────────────────────── */

/** Word-wrap text into lines that fit within maxWidth. */
function wrapText(
  ctx: SKRSContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const w of words) {
    const test = current ? `${current} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = w;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/* ── Renderer ───────────────────────────────────────────────────── */

export async function renderDaily(data: WordData): Promise<Uint8Array> {
  const palette = await loadPalette();
  const canvas = createFrame();
  const ctx = canvas.getContext("2d");

  const MARGIN_LEFT = 60;
  const CONTENT_WIDTH = WIDTH - MARGIN_LEFT * 2;

  // ── Background ──
  ctx.fillStyle = WHITE;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // ── Header bar (0–70) ──
  drawHeaderBar(ctx, 0, 70, BLACK);

  // Title text
  ctx.fillStyle = WHITE;
  ctx.font = "bold 32px Inter";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("WORD OF THE DAY", 40, 36);

  // Yellow accent stripe at bottom of header
  ctx.fillStyle = YELLOW;
  ctx.fillRect(0, 67, WIDTH, 3);

  // ── Measure content block to vertically centre it ──
  const HEADER_BOTTOM = 70;
  const AVAILABLE_HEIGHT = HEIGHT - HEADER_BOTTOM;

  // Pre-measure all text elements
  const wordFontSize = 44;
  const phoneticFontSize = 22;
  const posFontSize = 20;
  const defFontSize = 24;
  const exampleFontSize = 20;
  const lineSpacing = 1.4;

  // Measure definition lines
  ctx.font = `${defFontSize}px Inter`;
  const defLines = wrapText(ctx, data.definition, CONTENT_WIDTH);
  const maxDefLines = 4;
  const clampedDefLines = defLines.slice(0, maxDefLines);

  // Measure example lines (if present)
  let exampleLines: string[] = [];
  if (data.example) {
    ctx.font = `italic ${exampleFontSize}px Inter`;
    exampleLines = wrapText(ctx, `"${data.example}"`, CONTENT_WIDTH);
    exampleLines = exampleLines.slice(0, 3);
  }

  // Calculate total content height
  let contentHeight = 0;
  contentHeight += wordFontSize * lineSpacing;                               // word
  if (data.phonetic) contentHeight += phoneticFontSize * lineSpacing;        // phonetic
  contentHeight += posFontSize * lineSpacing;                                // part of speech
  contentHeight += 20;                                                       // gap before divider
  contentHeight += 3;                                                        // divider line
  contentHeight += 20;                                                       // gap after divider
  contentHeight += clampedDefLines.length * defFontSize * lineSpacing;       // definition
  if (exampleLines.length > 0) {
    contentHeight += 16;                                                     // gap before example
    contentHeight += exampleLines.length * exampleFontSize * lineSpacing;    // example
  }

  // Vertically centre the content block
  let y = HEADER_BOTTOM + (AVAILABLE_HEIGHT - contentHeight) / 2;

  // ── Word ──
  ctx.fillStyle = BLACK;
  ctx.font = `bold ${wordFontSize}px Inter`;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(data.word, MARGIN_LEFT, y);
  y += wordFontSize * lineSpacing;

  // ── Phonetic ──
  if (data.phonetic) {
    ctx.fillStyle = RED;
    ctx.font = `${phoneticFontSize}px Inter`;
    ctx.fillText(data.phonetic, MARGIN_LEFT, y);
    y += phoneticFontSize * lineSpacing;
  }

  // ── Part of speech ──
  ctx.fillStyle = BLACK;
  ctx.font = `italic ${posFontSize}px Inter`;
  ctx.fillText(data.partOfSpeech, MARGIN_LEFT, y);
  y += posFontSize * lineSpacing;

  // ── Yellow divider ──
  y += 20;
  ctx.fillStyle = YELLOW;
  ctx.fillRect(MARGIN_LEFT, y, 200, 3);
  y += 3 + 20;

  // ── Definition ──
  ctx.fillStyle = BLACK;
  ctx.font = `${defFontSize}px Inter`;
  for (const line of clampedDefLines) {
    ctx.fillText(line, MARGIN_LEFT, y);
    y += defFontSize * lineSpacing;
  }

  // ── Example ──
  if (exampleLines.length > 0) {
    y += 16;
    ctx.fillStyle = BLACK;
    ctx.font = `italic ${exampleFontSize}px Inter`;
    for (const line of exampleLines) {
      ctx.fillText(line, MARGIN_LEFT, y);
      y += exampleFontSize * lineSpacing;
    }
  }

  return canvasToFramebuffer(canvas, palette);
}
