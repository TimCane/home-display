/**
 * "On This Day" today renderer.
 * Layout: timeline style with header bar, vertical line, and event cards.
 */

import type { OnThisDayData } from "../fetch.js";
import {
  createFrame,
  loadPalette,
  canvasToFramebuffer,
  drawHeaderBar,
  truncateText,
  BLACK,
  WHITE,
  YELLOW,
  RED,
} from "../../render-utils.js";
import { WIDTH, HEIGHT } from "../../../../shared/framebuffer.js";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * Simple word-wrap that splits text into lines fitting within maxWidth.
 */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(" ");
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

export async function renderToday(
  data: OnThisDayData,
): Promise<Uint8Array> {
  const palette = await loadPalette();
  const canvas = createFrame();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ctx = canvas.getContext("2d") as any;

  // ── Background ──
  ctx.fillStyle = WHITE;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // ── Header bar (0-70) ──
  drawHeaderBar(ctx, 0, 70, BLACK);
  ctx.fillStyle = WHITE;
  ctx.font = "bold 32px Inter";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("ON THIS DAY", 40, 36);

  // Date right-aligned
  const dateStr = `${data.day} ${MONTH_NAMES[data.month - 1]}`;
  ctx.font = "24px Inter";
  ctx.textAlign = "right";
  ctx.fillText(dateStr, WIDTH - 40, 36);

  // ── Yellow accent stripe ──
  ctx.fillStyle = YELLOW;
  ctx.fillRect(0, 70, WIDTH, 3);

  // ── Timeline ──
  const eventCount = data.events.length;
  if (eventCount === 0) {
    ctx.fillStyle = BLACK;
    ctx.font = "24px Inter";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("No events found for today.", WIDTH / 2, HEIGHT / 2);
    return canvasToFramebuffer(canvas, palette);
  }

  const topY = 100;
  const bottomY = HEIGHT - 20;
  const timelineX = 80;
  const textLeft = 110;
  const textRight = WIDTH - 60;
  const textMaxWidth = textRight - textLeft;
  const yearLineH = 34;   // height of the year label row
  const lineHeight = 26;  // height per wrapped text line

  // Pre-measure each event's total height so we can space them properly
  ctx.font = "22px Inter";
  const eventHeights: number[] = data.events.map((event) => {
    const lines = wrapText(ctx, event.text, textMaxWidth);
    return yearLineH + lines.length * lineHeight;
  });

  const totalContentH = eventHeights.reduce((a, b) => a + b, 0);
  const availableH = bottomY - topY;
  const totalGap = availableH - totalContentH;
  const gap = eventCount > 1
    ? Math.max(10, totalGap / (eventCount - 1))
    : 0;

  // Compute Y positions based on actual heights
  const eventYPositions: number[] = [];
  // If single event, center it vertically
  if (eventCount === 1) {
    eventYPositions.push(topY + (availableH - eventHeights[0]) / 2);
  } else {
    let y = topY;
    for (let i = 0; i < eventCount; i++) {
      eventYPositions.push(y);
      y += eventHeights[i] + gap;
    }
  }

  // Vertical timeline line
  const lineTop = eventYPositions[0] + 14;
  const lineBottom = eventYPositions[eventYPositions.length - 1] + 14;
  ctx.strokeStyle = BLACK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(timelineX, lineTop);
  ctx.lineTo(timelineX, lineBottom);
  ctx.stroke();

  // ── Events ──
  for (let i = 0; i < eventCount; i++) {
    const event = data.events[i];
    const ey = eventYPositions[i];
    const dotY = ey + 14; // vertically center dot with year text

    // Yellow circle on timeline
    ctx.fillStyle = YELLOW;
    ctx.beginPath();
    ctx.arc(timelineX, dotY, 8, 0, Math.PI * 2);
    ctx.fill();

    // Year in bold red
    ctx.fillStyle = RED;
    ctx.font = "bold 28px Inter";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(String(event.year), textLeft, ey);

    // Event text in black, wrapped
    ctx.fillStyle = BLACK;
    ctx.font = "22px Inter";
    const lines = wrapText(ctx, event.text, textMaxWidth);

    const textStartY = ey + yearLineH;
    for (let l = 0; l < lines.length; l++) {
      ctx.fillText(lines[l], textLeft, textStartY + l * lineHeight);
    }
  }

  return canvasToFramebuffer(canvas, palette);
}
