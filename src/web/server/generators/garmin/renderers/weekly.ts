/**
 * Garmin "weekly" renderer.
 * 7-day step bar chart with weekly totals.
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
  formatSteps,
  formatDistance,
  DISPLAY_FONT,
  BLACK, WHITE, YELLOW,
} from "../format.js";

export async function renderWeekly(data: GarminData): Promise<Uint8Array> {
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
  ctx.fillText("WEEKLY STEPS", 40, 36);

  ctx.font = `24px ${DISPLAY_FONT}`;
  ctx.textAlign = "right";
  ctx.fillText(truncateText(ctx, data.displayName, 400), WIDTH - 40, 36);

  // ── Bar chart ──
  const steps = data.weeklySteps;
  const chartX = 80;
  const chartW = WIDTH - 160;
  const chartTop = 110;
  const chartBottom = 460;
  const chartH = chartBottom - chartTop;

  const maxSteps = Math.max(...steps.map((s) => s.steps), 1);
  const barCount = steps.length;
  const barGap = 20;
  const barW = (chartW - barGap * (barCount - 1)) / barCount;

  // Grid lines
  const gridLines = 4;
  for (let i = 0; i <= gridLines; i++) {
    const gy = chartTop + (chartH / gridLines) * i;
    ctx.strokeStyle = BLACK;
    ctx.globalAlpha = 0.08;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(chartX, gy);
    ctx.lineTo(chartX + chartW, gy);
    ctx.stroke();
    ctx.globalAlpha = 1.0;

    // Label
    const val = Math.round(maxSteps * (1 - i / gridLines));
    ctx.fillStyle = BLACK;
    ctx.font = `12px ${DISPLAY_FONT}`;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.globalAlpha = 0.4;
    ctx.fillText(formatSteps(val), chartX - 10, gy);
    ctx.globalAlpha = 1.0;
  }

  // Bars
  for (let i = 0; i < barCount; i++) {
    const s = steps[i];
    const bx = chartX + i * (barW + barGap);
    const barH = (s.steps / maxSteps) * chartH;
    const by = chartBottom - barH;

    // Bar fill
    const isToday = i === barCount - 1;
    ctx.fillStyle = isToday ? YELLOW : BLACK;
    roundedRectPath(ctx, bx, by, barW, barH, 6);
    ctx.fill();

    if (!isToday) {
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = BLACK;
      roundedRectPath(ctx, bx, by, barW, barH, 6);
      ctx.fill();
      ctx.globalAlpha = 1.0;
    }

    // Outline
    ctx.strokeStyle = BLACK;
    ctx.lineWidth = 1.5;
    roundedRectPath(ctx, bx, by, barW, barH, 6);
    ctx.stroke();

    // Step count above bar
    ctx.fillStyle = BLACK;
    ctx.font = `bold 14px ${DISPLAY_FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText(formatSteps(s.steps), bx + barW / 2, by - 6);

    // Day label below
    ctx.font = `bold 16px ${DISPLAY_FONT}`;
    ctx.textBaseline = "top";
    ctx.fillText(s.date, bx + barW / 2, chartBottom + 10);
  }

  // ── Weekly totals row ──
  const totalsY = 510;
  const totalSteps = steps.reduce((sum, s) => sum + s.steps, 0);
  const avgSteps = Math.round(totalSteps / Math.max(barCount, 1));

  // Activity totals from recent activities (last 7 days)
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekActivities = data.recentActivities.filter(
    (a) => a.startTime && new Date(a.startTime) >= weekAgo,
  );
  const totalDistance = weekActivities.reduce((sum, a) => sum + a.distance, 0);

  const totals = [
    { label: "TOTAL STEPS", value: totalSteps.toLocaleString() },
    { label: "DAILY AVG", value: avgSteps.toLocaleString() },
    { label: "ACTIVITIES", value: String(weekActivities.length) },
    { label: "DISTANCE", value: formatDistance(totalDistance) },
  ];

  const tCardW = (WIDTH - 100) / 4;
  const tGap = 15;

  for (let i = 0; i < totals.length; i++) {
    const tx = 30 + i * (tCardW + tGap);
    const t = totals[i];

    roundedRectPath(ctx, tx, totalsY, tCardW, 140, 10);
    ctx.fillStyle = WHITE;
    ctx.fill();
    ctx.strokeStyle = BLACK;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = BLACK;
    ctx.font = `bold 12px ${DISPLAY_FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.globalAlpha = 0.6;
    ctx.fillText(t.label, tx + tCardW / 2, totalsY + 20);
    ctx.globalAlpha = 1.0;

    ctx.font = `bold 28px ${DISPLAY_FONT}`;
    ctx.fillText(t.value, tx + tCardW / 2, totalsY + 50);
  }

  return canvasToFramebuffer(canvas, palette);
}
