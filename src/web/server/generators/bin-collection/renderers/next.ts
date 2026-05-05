/**
 * Bin collection "next" renderer.
 * Shows the next upcoming collection in a bold hero layout.
 */

import type { BinCollectionData } from "../fetch.js";
import {
  createFrame,
  loadPalette,
  loadTimezone,
  canvasToFramebuffer,
  drawHeaderBar,
  roundedRectPath,
  BLACK,
  WHITE,
  YELLOW,
  RED,
} from "../../render-utils.js";
import { WIDTH, HEIGHT } from "../../../../shared/framebuffer.js";
import type { SKRSContext2D } from "@napi-rs/canvas";

interface BinCollectionConfig {
  council_name: string;
}

/** Draw a simple bin icon procedurally. */
function drawBinIcon(
  ctx: SKRSContext2D,
  cx: number,
  cy: number,
  height: number,
): void {
  ctx.fillStyle = BLACK;
  ctx.strokeStyle = BLACK;
  ctx.lineWidth = 2;

  const bodyH = height * 0.7;
  const bodyTopW = height * 0.4;
  const bodyBotW = height * 0.32;
  const bodyTop = cy - height * 0.3;
  const bodyBot = bodyTop + bodyH;

  // Body: tapered trapezoid (wider at top)
  ctx.beginPath();
  ctx.moveTo(cx - bodyTopW / 2, bodyTop);
  ctx.lineTo(cx + bodyTopW / 2, bodyTop);
  ctx.lineTo(cx + bodyBotW / 2, bodyBot);
  ctx.lineTo(cx - bodyBotW / 2, bodyBot);
  ctx.closePath();
  ctx.fill();

  // Lid: rectangle above body
  const lidH = height * 0.1;
  const lidW = bodyTopW * 1.15;
  const lidTop = bodyTop - lidH;
  roundedRectPath(ctx, cx - lidW / 2, lidTop, lidW, lidH, 4);
  ctx.fill();

  // Handle: small rect on top of lid
  const handleW = height * 0.15;
  const handleH = height * 0.08;
  const handleTop = lidTop - handleH + 2;
  roundedRectPath(ctx, cx - handleW / 2, handleTop, handleW, handleH, 4);
  ctx.stroke();

  // Horizontal lines on body for detail
  ctx.strokeStyle = WHITE;
  ctx.lineWidth = 1.5;
  const lineCount = 3;
  for (let i = 1; i <= lineCount; i++) {
    const frac = i / (lineCount + 1);
    const ly = bodyTop + bodyH * frac;
    const lw = bodyTopW - (bodyTopW - bodyBotW) * frac;
    ctx.beginPath();
    ctx.moveTo(cx - lw / 2 + 4, ly);
    ctx.lineTo(cx + lw / 2 - 4, ly);
    ctx.stroke();
  }
}

export async function renderNext(
  data: BinCollectionData,
  _config: BinCollectionConfig,
): Promise<Uint8Array> {
  const palette = await loadPalette();
  const tz = await loadTimezone();
  const canvas = createFrame();
  const ctx = canvas.getContext("2d");

  // ── Background ──
  ctx.fillStyle = WHITE;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // ── Header bar (0-70) ──
  drawHeaderBar(ctx, 0, 70, BLACK);
  ctx.fillStyle = WHITE;
  ctx.font = "bold 30px Inter";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("BIN DAY", 40, 35);
  ctx.font = "22px Inter";
  ctx.textAlign = "right";
  ctx.fillText(data.councilName, WIDTH - 40, 35);

  // Yellow accent stripe
  ctx.fillStyle = YELLOW;
  ctx.fillRect(0, 70, WIDTH, 3);

  if (data.collections.length === 0) {
    // ── No collections ──
    ctx.fillStyle = BLACK;
    ctx.font = "36px Inter";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("No collections scheduled", WIDTH / 2, HEIGHT / 2);
    return canvasToFramebuffer(canvas, palette);
  }

  const next = data.collections[0];
  const collectionDate = new Date(next.date + "T12:00:00");

  // Calculate days until collection
  const now = new Date();
  const todayStr = now.toLocaleDateString("sv-SE", { timeZone: tz });
  const todayDate = new Date(todayStr + "T12:00:00");
  const diffMs = collectionDate.getTime() - todayDate.getTime();
  const diffDays = Math.round(diffMs / 86400000);

  // ── Bin icon ──
  const iconCy = 280;
  drawBinIcon(ctx, WIDTH / 2, iconCy, 150);

  // ── Bin type label ──
  ctx.fillStyle = BLACK;
  ctx.font = "bold 32px Inter";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText(next.binType.toUpperCase(), WIDTH / 2, 380);

  // ── Bin label ──
  ctx.font = "22px Inter";
  ctx.fillText(next.label, WIDTH / 2, 420);

  // ── Countdown pill ──
  let pillText: string;
  let pillBg: string;
  let pillFg: string;

  if (diffDays <= 0) {
    pillText = "PUT BINS OUT!";
    pillBg = YELLOW;
    pillFg = BLACK;
  } else if (diffDays === 1) {
    pillText = "TOMORROW";
    pillBg = YELLOW;
    pillFg = BLACK;
  } else {
    pillText = `in ${diffDays} days`;
    pillBg = RED;
    pillFg = WHITE;
  }

  ctx.font = "bold 28px Inter";
  const pillTextW = ctx.measureText(pillText).width;
  const pillW = pillTextW + 48;
  const pillH = 48;
  const pillX = WIDTH / 2 - pillW / 2;
  const pillY = 475;

  roundedRectPath(ctx, pillX, pillY, pillW, pillH, pillH / 2);
  ctx.fillStyle = pillBg;
  ctx.fill();

  ctx.fillStyle = pillFg;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(pillText, WIDTH / 2, pillY + pillH / 2);

  // ── Full date below pill ──
  const dateStr = collectionDate.toLocaleDateString("en-GB", {
    timeZone: tz,
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  ctx.fillStyle = BLACK;
  ctx.font = "24px Inter";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText(dateStr, WIDTH / 2, 545);

  return canvasToFramebuffer(canvas, palette);
}
