/**
 * Garmin "sleep" renderer.
 * Shows sleep duration, score, stage breakdown bar, body battery, HR, HRV.
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
  formatDurationShort,
  drawSleepIcon,
  DISPLAY_FONT,
  BLACK, WHITE, YELLOW,
} from "../format.js";
import { RED } from "../../render-utils.js";

export async function renderSleep(data: GarminData): Promise<Uint8Array> {
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
  ctx.fillText("SLEEP", 40, 36);

  ctx.font = `24px ${DISPLAY_FONT}`;
  ctx.textAlign = "right";
  ctx.fillText(truncateText(ctx, data.displayName, 400), WIDTH - 40, 36);

  const sleep = data.sleepDetail;
  if (!sleep || sleep.totalSeconds === 0) {
    ctx.fillStyle = BLACK;
    ctx.font = `28px ${DISPLAY_FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("No sleep data available", WIDTH / 2, HEIGHT / 2);
    return canvasToFramebuffer(canvas, palette);
  }

  // ── Big sleep duration ──
  drawSleepIcon(ctx, WIDTH / 2, 120);

  const hours = Math.floor(sleep.totalSeconds / 3600);
  const mins = Math.floor((sleep.totalSeconds % 3600) / 60);

  ctx.fillStyle = BLACK;
  ctx.font = `bold 72px ${DISPLAY_FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText(`${hours}h ${mins}m`, WIDTH / 2, 150);

  // Sleep score
  if (sleep.sleepScore !== null) {
    ctx.font = `bold 28px ${DISPLAY_FONT}`;
    ctx.fillStyle = YELLOW;
    ctx.fillText(`Score: ${sleep.sleepScore}`, WIDTH / 2, 235);
  }

  // ── Sleep stages bar ──
  const barY = 290;
  const barH = 40;
  const barX = 60;
  const barW = WIDTH - 120;

  const total = sleep.deepSeconds + sleep.lightSeconds + sleep.remSeconds + sleep.awakeSeconds;
  if (total > 0) {
    const segments = [
      { label: "Deep", seconds: sleep.deepSeconds, color: BLACK },
      { label: "Light", seconds: sleep.lightSeconds, color: YELLOW },
      { label: "REM", seconds: sleep.remSeconds, color: RED },
      { label: "Awake", seconds: sleep.awakeSeconds, color: WHITE },
    ];

    // Draw bar
    roundedRectPath(ctx, barX, barY, barW, barH, 8);
    ctx.strokeStyle = BLACK;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.save();
    roundedRectPath(ctx, barX, barY, barW, barH, 8);
    ctx.clip();

    let offsetX = barX;
    for (const seg of segments) {
      const w = (seg.seconds / total) * barW;
      ctx.fillStyle = seg.color;
      ctx.fillRect(offsetX, barY, w, barH);
      offsetX += w;
    }
    ctx.restore();

    // Re-draw border on top
    roundedRectPath(ctx, barX, barY, barW, barH, 8);
    ctx.strokeStyle = BLACK;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Legend below bar
    const legendY = barY + barH + 20;
    const legendSpacing = barW / segments.length;

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const lx = barX + i * legendSpacing;
      const pct = Math.round((seg.seconds / total) * 100);

      // Color swatch
      ctx.fillStyle = seg.color;
      ctx.fillRect(lx, legendY, 16, 16);
      ctx.strokeStyle = BLACK;
      ctx.lineWidth = 1;
      ctx.strokeRect(lx, legendY, 16, 16);

      // Label + duration
      ctx.fillStyle = BLACK;
      ctx.font = `bold 16px ${DISPLAY_FONT}`;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(seg.label, lx + 22, legendY - 1);

      ctx.font = `14px ${DISPLAY_FONT}`;
      ctx.globalAlpha = 0.6;
      ctx.fillText(
        `${formatDurationShort(seg.seconds)} (${pct}%)`,
        lx + 22,
        legendY + 18,
      );
      ctx.globalAlpha = 1.0;
    }
  }

  // ── Bottom stats row ──
  const statsY = 420;
  const cardW = (WIDTH - 100) / 3;
  const cardH = 200;
  const gap = 20;

  const bottomStats = [
    {
      label: "BODY BATTERY",
      value: sleep.bodyBatteryChange !== null
        ? `${sleep.bodyBatteryChange >= 0 ? "+" : ""}${sleep.bodyBatteryChange}`
        : "--",
    },
    {
      label: "RESTING HR",
      value: sleep.restingHeartRate !== null
        ? `${sleep.restingHeartRate} bpm`
        : "--",
    },
    {
      label: "AVG HRV",
      value: sleep.avgOvernightHrv !== null
        ? `${Math.round(sleep.avgOvernightHrv)} ms`
        : "--",
    },
  ];

  for (let i = 0; i < bottomStats.length; i++) {
    const cx = 40 + i * (cardW + gap);
    const stat = bottomStats[i];

    roundedRectPath(ctx, cx, statsY, cardW, cardH, 12);
    ctx.fillStyle = WHITE;
    ctx.fill();
    ctx.strokeStyle = BLACK;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Yellow top accent
    ctx.save();
    roundedRectPath(ctx, cx, statsY, cardW, 6, 12);
    ctx.clip();
    ctx.fillStyle = YELLOW;
    ctx.fillRect(cx, statsY, cardW, 6);
    ctx.restore();

    ctx.fillStyle = BLACK;
    ctx.font = `bold 14px ${DISPLAY_FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.globalAlpha = 0.6;
    ctx.fillText(stat.label, cx + cardW / 2, statsY + 30);
    ctx.globalAlpha = 1.0;

    ctx.font = `bold 42px ${DISPLAY_FONT}`;
    ctx.fillText(stat.value, cx + cardW / 2, statsY + 65);
  }

  return canvasToFramebuffer(canvas, palette);
}
