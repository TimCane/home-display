/**
 * Calendar "today_tomorrow" renderer.
 * Layout: yellow header bar, two-column list with time badges.
 */

import type { CalendarData } from "../fetch.js";
import { bucketByDay } from "../fetch.js";
import {
  createFrame,
  loadPalette,
  loadTimezone,
  canvasToFramebuffer,
  drawHeaderBar,
  roundedRectPath,
  truncateText,
  BLACK, WHITE, YELLOW, RED,
} from "../../render-utils.js";
import { WIDTH, HEIGHT } from "../../../../shared/framebuffer.js";

interface CalendarConfig {
  ics_url: string;
  calendar_name: string;
}

export async function renderTodayTomorrow(
  data: CalendarData,
  _config: CalendarConfig,
): Promise<Uint8Array> {
  const palette = await loadPalette();
  const tz = await loadTimezone();
  const canvas = createFrame();
  const ctx = canvas.getContext("2d");

  // ── Background ──
  ctx.fillStyle = WHITE;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // ── Header bar (0-65) ──
  drawHeaderBar(ctx, 0, 65, YELLOW);
  ctx.fillStyle = BLACK;
  ctx.font = "bold 30px Inter";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(data.calendarName, 40, 33);
  ctx.font = "22px Inter";
  ctx.textAlign = "right";
  ctx.fillText("Today & Tomorrow", WIDTH - 40, 33);

  // ── Columns ──
  const buckets = bucketByDay(data.events, tz, 2);
  const keys = [...buckets.keys()];

  const colWidth = 420;
  const colLeft = [35, 500];
  const headerY = 82;
  const listTop = 140;
  const rowHeight = 54;
  const maxEvents = Math.floor((HEIGHT - listTop - 20) / rowHeight);

  // Vertical divider
  ctx.strokeStyle = BLACK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(WIDTH / 2 - 5, headerY);
  ctx.lineTo(WIDTH / 2 - 5, HEIGHT - 15);
  ctx.stroke();

  for (let col = 0; col < 2; col++) {
    const x = colLeft[col];
    const dateKey = keys[col];
    if (!dateKey) continue;

    const events = buckets.get(dateKey) ?? [];

    // Column sub-header
    const date = new Date(dateKey + "T12:00:00");
    const dayLabel = col === 0 ? "Today" : "Tomorrow";
    const dateLabel = date.toLocaleDateString("en-GB", {
      timeZone: tz,
      weekday: "short",
      day: "numeric",
      month: "short",
    });

    ctx.fillStyle = BLACK;
    ctx.font = "bold 28px Inter";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(dayLabel, x, headerY);

    ctx.font = "22px Inter";
    ctx.textAlign = "right";
    ctx.fillText(dateLabel, x + colWidth, headerY + 4);

    // Yellow underline accent
    ctx.fillStyle = YELLOW;
    ctx.fillRect(x, headerY + 36, colWidth, 4);

    if (events.length === 0) {
      ctx.fillStyle = BLACK;
      ctx.font = "italic 24px Inter";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText("No events", x + 8, listTop);
      continue;
    }

    // Event rows
    const visibleCount = Math.min(events.length, maxEvents);
    for (let i = 0; i < visibleCount; i++) {
      const evt = events[i];
      const ry = listTop + i * rowHeight;

      // Time badge
      let timeStr: string;
      let badgeColor: string;
      let badgeTextColor: string;
      if (evt.allDay) {
        timeStr = "ALL DAY";
        badgeColor = YELLOW;
        badgeTextColor = BLACK;
      } else {
        timeStr = evt.start.toLocaleTimeString("en-GB", {
          timeZone: tz,
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        });
        badgeColor = RED;
        badgeTextColor = WHITE;
      }

      ctx.font = "bold 18px Inter";
      const badgeW = Math.max(74, ctx.measureText(timeStr).width + 18);
      roundedRectPath(ctx, x, ry + 2, badgeW, 30, 15);
      ctx.fillStyle = badgeColor;
      ctx.fill();

      ctx.fillStyle = badgeTextColor;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(timeStr, x + badgeW / 2, ry + 17);

      // Event summary
      ctx.fillStyle = BLACK;
      ctx.font = "22px Inter";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      const maxTextW = colWidth - badgeW - 16;
      const summary = truncateText(ctx, evt.summary, maxTextW);
      ctx.fillText(summary, x + badgeW + 10, ry + 17);

      // Subtle separator
      if (i < visibleCount - 1) {
        ctx.strokeStyle = BLACK;
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(x, ry + rowHeight - 4);
        ctx.lineTo(x + colWidth, ry + rowHeight - 4);
        ctx.stroke();
      }
    }

    // Overflow indicator
    if (events.length > maxEvents) {
      const overflowY = listTop + maxEvents * rowHeight;
      ctx.fillStyle = BLACK;
      ctx.font = "italic 18px Inter";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(`+${events.length - maxEvents} more`, x + 8, overflowY);
    }
  }

  return canvasToFramebuffer(canvas, palette);
}
