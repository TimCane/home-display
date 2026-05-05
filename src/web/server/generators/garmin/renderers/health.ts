/**
 * Garmin "health" renderer.
 * Combined 4-panel dashboard: steps, heart rate, sleep, weight/hydration.
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
  formatWeight,
  formatDurationShort,
  drawStepsIcon,
  drawHeartIcon,
  drawSleepIcon,
  drawScaleIcon,
  drawDropIcon,
  DISPLAY_FONT,
  BLACK, WHITE, YELLOW,
} from "../format.js";

export async function renderHealth(data: GarminData): Promise<Uint8Array> {
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
  ctx.fillText("HEALTH", 40, 36);

  ctx.font = `24px ${DISPLAY_FONT}`;
  ctx.textAlign = "right";
  ctx.fillText(truncateText(ctx, data.displayName, 400), WIDTH - 40, 36);

  // ── 2×2 grid of cards ──
  const gridX = 25;
  const gridY = 95;
  const gap = 20;
  const cardW = (WIDTH - gridX * 2 - gap) / 2;
  const cardH = (HEIGHT - gridY - 25 - gap) / 2;

  // Card 1: Steps (top-left)
  drawCard(ctx, gridX, gridY, cardW, cardH, () => {
    drawStepsIcon(ctx, gridX + cardW / 2, gridY + 50);

    ctx.fillStyle = BLACK;
    ctx.font = `bold 14px ${DISPLAY_FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.globalAlpha = 0.6;
    ctx.fillText("STEPS", gridX + cardW / 2, gridY + 75);
    ctx.globalAlpha = 1.0;

    ctx.font = `bold 56px ${DISPLAY_FONT}`;
    ctx.fillText(formatSteps(data.daily.steps), gridX + cardW / 2, gridY + 100);

    // Weekly mini bar chart
    if (data.weeklySteps.length > 0) {
      const miniY = gridY + cardH - 90;
      const miniH = 50;
      const miniX = gridX + 30;
      const miniW = cardW - 60;
      const maxS = Math.max(...data.weeklySteps.map((s) => s.steps), 1);
      const bw = (miniW - (data.weeklySteps.length - 1) * 4) / data.weeklySteps.length;

      for (let i = 0; i < data.weeklySteps.length; i++) {
        const s = data.weeklySteps[i];
        const bx = miniX + i * (bw + 4);
        const bh = (s.steps / maxS) * miniH;
        const by = miniY + miniH - bh;

        ctx.fillStyle = i === data.weeklySteps.length - 1 ? YELLOW : BLACK;
        ctx.globalAlpha = i === data.weeklySteps.length - 1 ? 1.0 : 0.3;
        roundedRectPath(ctx, bx, by, bw, bh, 3);
        ctx.fill();
        ctx.globalAlpha = 1.0;

        // Day label
        ctx.fillStyle = BLACK;
        ctx.font = `10px ${DISPLAY_FONT}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.globalAlpha = 0.5;
        ctx.fillText(s.date.slice(0, 2), bx + bw / 2, miniY + miniH + 4);
        ctx.globalAlpha = 1.0;
      }
    }
  });

  // Card 2: Heart Rate (top-right)
  const hrX = gridX + cardW + gap;
  drawCard(ctx, hrX, gridY, cardW, cardH, () => {
    drawHeartIcon(ctx, hrX + cardW / 2, gridY + 50);

    ctx.fillStyle = BLACK;
    ctx.font = `bold 14px ${DISPLAY_FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.globalAlpha = 0.6;
    ctx.fillText("HEART RATE", hrX + cardW / 2, gridY + 75);
    ctx.globalAlpha = 1.0;

    const resting = data.daily.heartRate.resting;
    ctx.font = `bold 56px ${DISPLAY_FONT}`;
    ctx.fillText(resting ? `${resting}` : "--", hrX + cardW / 2, gridY + 100);

    ctx.font = `20px ${DISPLAY_FONT}`;
    ctx.globalAlpha = 0.6;
    ctx.fillText("resting bpm", hrX + cardW / 2, gridY + 170);
    ctx.globalAlpha = 1.0;

    // Range
    const hr = data.daily.heartRate;
    if (hr.min && hr.max) {
      const rangeY = gridY + cardH - 70;

      ctx.font = `16px ${DISPLAY_FONT}`;
      ctx.globalAlpha = 0.5;
      ctx.fillText("Today's range", hrX + cardW / 2, rangeY);
      ctx.globalAlpha = 1.0;

      ctx.font = `bold 24px ${DISPLAY_FONT}`;
      ctx.fillText(`${hr.min} – ${hr.max} bpm`, hrX + cardW / 2, rangeY + 24);
    }
  });

  // Card 3: Sleep (bottom-left)
  const sleepY = gridY + cardH + gap;
  drawCard(ctx, gridX, sleepY, cardW, cardH, () => {
    drawSleepIcon(ctx, gridX + cardW / 2, sleepY + 50);

    ctx.fillStyle = BLACK;
    ctx.font = `bold 14px ${DISPLAY_FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.globalAlpha = 0.6;
    ctx.fillText("SLEEP", gridX + cardW / 2, sleepY + 75);
    ctx.globalAlpha = 1.0;

    const sleep = data.daily.sleep;
    ctx.font = `bold 56px ${DISPLAY_FONT}`;
    ctx.fillText(
      sleep ? `${sleep.hours}h ${sleep.minutes}m` : "--",
      gridX + cardW / 2,
      sleepY + 100,
    );

    // Sleep score
    if (data.sleepDetail?.sleepScore !== null && data.sleepDetail?.sleepScore !== undefined) {
      ctx.font = `bold 24px ${DISPLAY_FONT}`;
      ctx.fillStyle = YELLOW;
      ctx.fillText(`Score: ${data.sleepDetail.sleepScore}`, gridX + cardW / 2, sleepY + 175);
    }

    // Stage breakdown
    const sd = data.sleepDetail;
    if (sd && sd.totalSeconds > 0) {
      const total = sd.deepSeconds + sd.lightSeconds + sd.remSeconds + sd.awakeSeconds;
      if (total > 0) {
        const barX2 = gridX + 30;
        const barW2 = cardW - 60;
        const barY2 = sleepY + cardH - 50;
        const barH2 = 20;

        roundedRectPath(ctx, barX2, barY2, barW2, barH2, 5);
        ctx.strokeStyle = BLACK;
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.save();
        roundedRectPath(ctx, barX2, barY2, barW2, barH2, 5);
        ctx.clip();
        let ox = barX2;
        const segs = [
          { s: sd.deepSeconds, c: BLACK },
          { s: sd.lightSeconds, c: YELLOW },
          { s: sd.remSeconds, c: "#CC0000" },
          { s: sd.awakeSeconds, c: WHITE },
        ];
        for (const seg of segs) {
          const w = (seg.s / total) * barW2;
          ctx.fillStyle = seg.c;
          ctx.fillRect(ox, barY2, w, barH2);
          ox += w;
        }
        ctx.restore();
        roundedRectPath(ctx, barX2, barY2, barW2, barH2, 5);
        ctx.strokeStyle = BLACK;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
  });

  // Card 4: Weight & Hydration (bottom-right)
  const wX = gridX + cardW + gap;
  const wY = gridY + cardH + gap;
  drawCard(ctx, wX, wY, cardW, cardH, () => {
    // Weight section
    drawScaleIcon(ctx, wX + cardW / 2, wY + 45);

    ctx.fillStyle = BLACK;
    ctx.font = `bold 14px ${DISPLAY_FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.globalAlpha = 0.6;
    ctx.fillText("WEIGHT", wX + cardW / 2, wY + 70);
    ctx.globalAlpha = 1.0;

    if (data.weight?.weightGrams) {
      ctx.font = `bold 48px ${DISPLAY_FONT}`;
      ctx.fillText(formatWeight(data.weight.weightGrams), wX + cardW / 2, wY + 90);
      ctx.font = `20px ${DISPLAY_FONT}`;
      ctx.globalAlpha = 0.6;
      ctx.fillText("kg", wX + cardW / 2, wY + 148);
      ctx.globalAlpha = 1.0;

      // BMI / body fat
      const extras: string[] = [];
      if (data.weight.bmi) extras.push(`BMI ${data.weight.bmi.toFixed(1)}`);
      if (data.weight.bodyFatPct) extras.push(`${data.weight.bodyFatPct.toFixed(1)}% fat`);
      if (extras.length > 0) {
        ctx.font = `16px ${DISPLAY_FONT}`;
        ctx.globalAlpha = 0.5;
        ctx.fillText(extras.join("  ·  "), wX + cardW / 2, wY + 175);
        ctx.globalAlpha = 1.0;
      }
    } else {
      ctx.font = `bold 48px ${DISPLAY_FONT}`;
      ctx.fillText("--", wX + cardW / 2, wY + 90);
    }

    // Hydration
    ctx.fillStyle = YELLOW;
    ctx.fillRect(wX + 30, wY + cardH / 2 + 20, cardW - 60, 2);

    drawDropIcon(ctx, wX + cardW / 2, wY + cardH / 2 + 55);

    ctx.fillStyle = BLACK;
    ctx.font = `bold 14px ${DISPLAY_FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.globalAlpha = 0.6;
    ctx.fillText("HYDRATION", wX + cardW / 2, wY + cardH / 2 + 75);
    ctx.globalAlpha = 1.0;

    ctx.font = `bold 36px ${DISPLAY_FONT}`;
    ctx.fillText(
      data.hydrationMl !== null ? `${data.hydrationMl} ml` : "--",
      wX + cardW / 2,
      wY + cardH / 2 + 98,
    );
  });

  return canvasToFramebuffer(canvas, palette);
}

/* ── Card helper ───────────────────────────────────────────────── */

function drawCard(
  ctx: ReturnType<ReturnType<typeof createFrame>["getContext"]>,
  x: number,
  y: number,
  w: number,
  h: number,
  draw: () => void,
): void {
  roundedRectPath(ctx, x, y, w, h, 12);
  ctx.fillStyle = WHITE;
  ctx.fill();
  ctx.strokeStyle = BLACK;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Yellow top accent
  ctx.save();
  roundedRectPath(ctx, x, y, w, 6, 12);
  ctx.clip();
  ctx.fillStyle = YELLOW;
  ctx.fillRect(x, y, w, 6);
  ctx.restore();

  draw();
}
