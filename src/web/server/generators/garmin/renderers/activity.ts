/**
 * Garmin "activity" renderer.
 * Shows the latest activity in a full-width detailed view.
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
  formatDistance,
  formatDuration,
  formatDate,
  formatPace,
  formatSpeed,
  activityLabel,
  isRunOrWalk,
  DISPLAY_FONT,
  BLACK, WHITE, YELLOW,
} from "../format.js";

export async function renderActivity(data: GarminData): Promise<Uint8Array> {
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
  ctx.fillText("LATEST ACTIVITY", 40, 36);

  const latest = data.recentActivities[0];
  if (!latest) {
    ctx.fillStyle = BLACK;
    ctx.font = `28px ${DISPLAY_FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("No activities recorded yet", WIDTH / 2, HEIGHT / 2);
    return canvasToFramebuffer(canvas, palette);
  }

  // ── Activity name + badge ──
  const badge = activityLabel(latest.type);
  ctx.fillStyle = YELLOW;
  roundedRectPath(ctx, 40, 100, 80, 36, 6);
  ctx.fill();

  ctx.fillStyle = BLACK;
  ctx.font = `bold 18px ${DISPLAY_FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(badge, 80, 118);

  ctx.fillStyle = BLACK;
  ctx.font = `bold 32px ${DISPLAY_FONT}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(truncateText(ctx, latest.name, WIDTH - 280), 140, 118);

  // Date
  ctx.font = `20px ${DISPLAY_FONT}`;
  ctx.textAlign = "right";
  ctx.fillText(formatDate(latest.startTime), WIDTH - 40, 118);

  // ── Yellow divider ──
  ctx.fillStyle = YELLOW;
  ctx.fillRect(40, 155, WIDTH - 80, 3);

  // ── Stats grid (2 rows × 3 cols) ──
  const stats = [
    { label: "Distance", value: formatDistance(latest.distance) },
    { label: "Duration", value: formatDuration(latest.duration) },
    {
      label: isRunOrWalk(latest.type) ? "Pace" : "Speed",
      value: isRunOrWalk(latest.type)
        ? formatPace(latest.averageSpeed)
        : formatSpeed(latest.averageSpeed),
    },
    { label: "Elevation", value: `${Math.round(latest.elevationGain)} m` },
    {
      label: "Avg HR",
      value: latest.averageHR ? `${Math.round(latest.averageHR)} bpm` : "--",
    },
    {
      label: "Max HR",
      value: latest.maxHR ? `${Math.round(latest.maxHR)} bpm` : "--",
    },
    {
      label: "Calories",
      value: latest.calories ? `${Math.round(latest.calories)}` : "--",
    },
    {
      label: "Steps",
      value: latest.steps ? `${latest.steps.toLocaleString()}` : "--",
    },
  ];

  const gridTop = 190;
  const colW = (WIDTH - 120) / 3;
  const rowH = 110;

  for (let i = 0; i < stats.length; i++) {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const sx = 60 + col * colW;
    const sy = gridTop + row * rowH;

    // Card background
    roundedRectPath(ctx, sx - 10, sy, colW - 20, rowH - 15, 10);
    ctx.fillStyle = WHITE;
    ctx.fill();
    ctx.strokeStyle = BLACK;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Value
    ctx.fillStyle = BLACK;
    ctx.font = `bold 34px ${DISPLAY_FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(stats[i].value, sx + (colW - 20) / 2 - 10, sy + 15);

    // Label
    ctx.font = `16px ${DISPLAY_FONT}`;
    ctx.globalAlpha = 0.6;
    ctx.fillText(stats[i].label, sx + (colW - 20) / 2 - 10, sy + 58);
    ctx.globalAlpha = 1.0;
  }

  // ── Previous activities (compact list at bottom) ──
  const listY = gridTop + Math.ceil(stats.length / 3) * rowH + 20;
  const prev = data.recentActivities.slice(1, 4);

  if (prev.length > 0) {
    ctx.fillStyle = BLACK;
    ctx.font = `bold 18px ${DISPLAY_FONT}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("PREVIOUS", 40, listY);
    ctx.fillStyle = YELLOW;
    ctx.fillRect(40, listY + 22, 50, 3);

    for (let i = 0; i < prev.length; i++) {
      const a = prev[i];
      const ry = listY + 35 + i * 46;

      ctx.fillStyle = BLACK;
      ctx.font = `16px ${DISPLAY_FONT}`;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";

      const summary = [
        activityLabel(a.type),
        truncateText(ctx, a.name, 250),
        a.distance > 0 ? formatDistance(a.distance) : null,
        formatDuration(a.duration),
      ]
        .filter(Boolean)
        .join("  ·  ");

      ctx.fillText(summary, 40, ry);
      ctx.font = `14px ${DISPLAY_FONT}`;
      ctx.textAlign = "right";
      ctx.globalAlpha = 0.6;
      ctx.fillText(formatDate(a.startTime), WIDTH - 40, ry);
      ctx.globalAlpha = 1.0;
    }
  }

  return canvasToFramebuffer(canvas, palette);
}
