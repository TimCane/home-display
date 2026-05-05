/**
 * Garmin "summary" renderer.
 * Layout: header bar, daily stats cards, recent activities list.
 */

import type { GarminData, GarminActivity } from "../fetch.js";
import {
  createFrame,
  loadPalette,
  canvasToFramebuffer,
  drawHeaderBar,
  roundedRectPath,
  truncateText,
  DISPLAY_FONT,
  BLACK, WHITE, YELLOW,
} from "../../render-utils.js";
import { WIDTH, HEIGHT } from "../../../../shared/framebuffer.js";
import {
  formatDistance,
  formatDuration,
  formatDate,
  formatSteps,
  activityLabel,
  drawStepsIcon,
  drawHeartIcon,
  drawSleepIcon,
} from "../format.js";

/* ── Main render ───────────────────────────────────────────────── */

export async function renderSummary(data: GarminData): Promise<Uint8Array> {
  const palette = await loadPalette();
  const canvas = createFrame();
  const ctx = canvas.getContext("2d");

  // ── Background ──
  ctx.fillStyle = WHITE;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // ── Header bar (0-70) ──
  drawHeaderBar(ctx, 0, 70, BLACK);

  ctx.fillStyle = YELLOW;
  ctx.fillRect(0, 70, WIDTH, 3);

  ctx.fillStyle = WHITE;
  ctx.font = `bold 32px ${DISPLAY_FONT}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("GARMIN", 40, 36);

  ctx.font = `24px ${DISPLAY_FONT}`;
  ctx.textAlign = "right";
  ctx.fillText(truncateText(ctx, data.displayName, 400), WIDTH - 40, 36);

  // ── Daily stats cards row (y=95) ──
  drawDailyStats(ctx, data, 95);

  // ── Recent activities (y=340) ──
  drawRecentActivities(ctx, data.recentActivities, 340);

  return canvasToFramebuffer(canvas, palette);
}

/* ── Daily stats cards ─────────────────────────────────────────── */

function drawDailyStats(
  ctx: ReturnType<ReturnType<typeof createFrame>["getContext"]>,
  data: GarminData,
  y: number,
): void {
  const cardH = 220;
  const gap = 20;
  const cardW = (WIDTH - 40 - gap * 2) / 3;
  const startX = 20;

  const cards = [
    {
      title: "STEPS",
      value: formatSteps(data.daily.steps),
      icon: drawStepsIcon,
    },
    {
      title: "HEART RATE",
      value: data.daily.heartRate.resting
        ? `${data.daily.heartRate.resting}`
        : "--",
      subtitle: data.daily.heartRate.resting ? "resting bpm" : "",
      extra:
        data.daily.heartRate.min && data.daily.heartRate.max
          ? `${data.daily.heartRate.min} – ${data.daily.heartRate.max} bpm`
          : null,
      icon: drawHeartIcon,
    },
    {
      title: "SLEEP",
      value: data.daily.sleep
        ? `${data.daily.sleep.hours}h ${data.daily.sleep.minutes}m`
        : "--",
      icon: drawSleepIcon,
    },
  ];

  for (let i = 0; i < cards.length; i++) {
    const cx = startX + i * (cardW + gap);
    const card = cards[i];

    roundedRectPath(ctx, cx, y, cardW, cardH, 12);
    ctx.fillStyle = WHITE;
    ctx.fill();
    ctx.strokeStyle = BLACK;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.save();
    ctx.beginPath();
    roundedRectPath(ctx, cx, y, cardW, 6, 12);
    ctx.clip();
    ctx.fillStyle = YELLOW;
    ctx.fillRect(cx, y, cardW, 6);
    ctx.restore();

    card.icon(ctx, cx + cardW / 2, y + 50);

    ctx.fillStyle = BLACK;
    ctx.font = `bold 16px ${DISPLAY_FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.globalAlpha = 0.6;
    ctx.fillText(card.title, cx + cardW / 2, y + 80);
    ctx.globalAlpha = 1.0;

    ctx.font = `bold 48px ${DISPLAY_FONT}`;
    ctx.fillText(card.value, cx + cardW / 2, y + 108);

    if (card.subtitle) {
      ctx.font = `16px ${DISPLAY_FONT}`;
      ctx.globalAlpha = 0.6;
      ctx.fillText(card.subtitle, cx + cardW / 2, y + 164);
      ctx.globalAlpha = 1.0;
    }

    if (card.extra) {
      ctx.font = `14px ${DISPLAY_FONT}`;
      ctx.globalAlpha = 0.5;
      ctx.fillText(card.extra, cx + cardW / 2, y + 186);
      ctx.globalAlpha = 1.0;
    }
  }
}

/* ── Recent activities list ────────────────────────────────────── */

function drawRecentActivities(
  ctx: ReturnType<ReturnType<typeof createFrame>["getContext"]>,
  activities: GarminActivity[],
  startY: number,
): void {
  ctx.fillStyle = BLACK;
  ctx.font = `bold 20px ${DISPLAY_FONT}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText("RECENT ACTIVITIES", 30, startY);

  ctx.fillStyle = YELLOW;
  ctx.fillRect(30, startY + 26, 60, 3);

  if (activities.length === 0) {
    ctx.fillStyle = BLACK;
    ctx.font = `18px ${DISPLAY_FONT}`;
    ctx.globalAlpha = 0.6;
    ctx.fillText("No activities recorded yet", 30, startY + 45);
    ctx.globalAlpha = 1.0;
    return;
  }

  const rowH = 58;
  const maxRows = Math.min(activities.length, 5);

  for (let i = 0; i < maxRows; i++) {
    const a = activities[i];
    const ry = startY + 42 + i * rowH;

    if (i > 0) {
      ctx.strokeStyle = BLACK;
      ctx.globalAlpha = 0.1;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(30, ry - 4);
      ctx.lineTo(WIDTH - 30, ry - 4);
      ctx.stroke();
      ctx.globalAlpha = 1.0;
    }

    const badge = activityLabel(a.type);
    ctx.fillStyle = YELLOW;
    roundedRectPath(ctx, 30, ry + 8, 56, 26, 4);
    ctx.fill();

    ctx.fillStyle = BLACK;
    ctx.font = `bold 12px ${DISPLAY_FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(badge, 58, ry + 21);

    ctx.fillStyle = BLACK;
    ctx.font = `18px ${DISPLAY_FONT}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(truncateText(ctx, a.name, 340), 100, ry + 4);

    ctx.font = `14px ${DISPLAY_FONT}`;
    ctx.globalAlpha = 0.6;
    const details = [
      a.distance > 0 ? formatDistance(a.distance) : null,
      a.duration > 0 ? formatDuration(a.duration) : null,
      a.averageHR ? `${Math.round(a.averageHR)} bpm` : null,
    ]
      .filter(Boolean)
      .join("  ·  ");
    ctx.fillText(details, 100, ry + 28);
    ctx.globalAlpha = 1.0;

    ctx.font = `14px ${DISPLAY_FONT}`;
    ctx.textAlign = "right";
    ctx.globalAlpha = 0.6;
    ctx.fillText(formatDate(a.startTime), WIDTH - 30, ry + 14);
    ctx.globalAlpha = 1.0;
  }
}
