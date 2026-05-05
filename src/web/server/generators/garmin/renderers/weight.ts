/**
 * Garmin "weight" renderer.
 * Clean display of current weight, BMI, body fat, body composition.
 */

import type { GarminData } from "../fetch.js";
import {
  createFrame,
  loadPalette,
  canvasToFramebuffer,
  drawHeaderBar,
  roundedRectPath,
  truncateText,
} from "../../render-utils.js";
import { WIDTH, HEIGHT } from "../../../../shared/framebuffer.js";
import {
  formatWeight,
  drawScaleIcon,
  DISPLAY_FONT,
  BLACK, WHITE, YELLOW,
} from "../format.js";

export async function renderWeight(data: GarminData): Promise<Uint8Array> {
  const palette = await loadPalette();
  const canvas = createFrame();
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = WHITE;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // ── Header ──
  drawHeaderBar(ctx, 0, 70, BLACK);
  ctx.fillStyle = YELLOW;
  ctx.fillRect(0, 70, WIDTH, 3);

  ctx.fillStyle = WHITE;
  ctx.font = `bold 32px ${DISPLAY_FONT}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("WEIGHT", 40, 36);

  ctx.font = `24px ${DISPLAY_FONT}`;
  ctx.textAlign = "right";
  ctx.fillText(truncateText(ctx, data.displayName, 400), WIDTH - 40, 36);

  const w = data.weight;
  if (!w || !w.weightGrams) {
    ctx.fillStyle = BLACK;
    ctx.font = `28px ${DISPLAY_FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("No weight data available", WIDTH / 2, HEIGHT / 2);
    return canvasToFramebuffer(canvas, palette);
  }

  // ── Scale icon ──
  drawScaleIcon(ctx, WIDTH / 2, 130);

  // ── Big weight ──
  ctx.fillStyle = BLACK;
  ctx.font = `bold 96px ${DISPLAY_FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText(formatWeight(w.weightGrams), WIDTH / 2, 170);

  ctx.font = `bold 32px ${DISPLAY_FONT}`;
  ctx.globalAlpha = 0.5;
  ctx.fillText("kg", WIDTH / 2, 280);
  ctx.globalAlpha = 1.0;

  // ── Yellow divider ──
  ctx.fillStyle = YELLOW;
  ctx.fillRect(WIDTH / 2 - 50, 330, 100, 4);

  // ── Body composition cards ──
  const metrics: { label: string; value: string }[] = [];

  if (w.bmi !== null) {
    metrics.push({ label: "BMI", value: w.bmi.toFixed(1) });
  }
  if (w.bodyFatPct !== null) {
    metrics.push({ label: "Body Fat", value: `${w.bodyFatPct.toFixed(1)}%` });
  }
  if (w.bodyWaterPct !== null) {
    metrics.push({ label: "Body Water", value: `${w.bodyWaterPct.toFixed(1)}%` });
  }
  if (w.muscleMassGrams !== null) {
    metrics.push({ label: "Muscle Mass", value: `${(w.muscleMassGrams / 1000).toFixed(1)} kg` });
  }
  if (w.boneMassGrams !== null) {
    metrics.push({ label: "Bone Mass", value: `${(w.boneMassGrams / 1000).toFixed(1)} kg` });
  }

  if (metrics.length === 0) return canvasToFramebuffer(canvas, palette);

  const cols = Math.min(metrics.length, 3);
  const rows = Math.ceil(metrics.length / cols);
  const gap = 20;
  const mCardW = (WIDTH - 80 - gap * (cols - 1)) / cols;
  const mCardH = rows === 1 ? 200 : 130;
  const startY = 360;

  for (let i = 0; i < metrics.length; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const mx = 40 + col * (mCardW + gap);
    const my = startY + row * (mCardH + gap);
    const m = metrics[i];

    roundedRectPath(ctx, mx, my, mCardW, mCardH, 10);
    ctx.fillStyle = WHITE;
    ctx.fill();
    ctx.strokeStyle = BLACK;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Yellow top accent
    ctx.save();
    roundedRectPath(ctx, mx, my, mCardW, 5, 10);
    ctx.clip();
    ctx.fillStyle = YELLOW;
    ctx.fillRect(mx, my, mCardW, 5);
    ctx.restore();

    ctx.fillStyle = BLACK;
    ctx.font = `bold 14px ${DISPLAY_FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.globalAlpha = 0.6;
    ctx.fillText(m.label, mx + mCardW / 2, my + 20);
    ctx.globalAlpha = 1.0;

    ctx.font = `bold 36px ${DISPLAY_FONT}`;
    ctx.fillText(m.value, mx + mCardW / 2, my + 50);
  }

  return canvasToFramebuffer(canvas, palette);
}
