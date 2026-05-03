/**
 * Calendar "today_tomorrow" renderer.
 * Layout: two-column list — today's events on the left, tomorrow's on the right.
 */

import type { CalendarData } from "../fetch.js";
import { bucketByDay } from "../fetch.js";
import {
  createFrame,
  loadPalette,
  loadTimezone,
  canvasToFramebuffer,
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

  const black = "#000000";
  const white = "#FFFFFF";
  const red = "#CC0000";

  // Background
  ctx.fillStyle = white;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Title
  ctx.fillStyle = black;
  ctx.font = "bold 36px sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(data.calendarName, 40, 30);

  // Bucket into today & tomorrow
  const buckets = bucketByDay(data.events, tz, 2);
  const keys = [...buckets.keys()];

  const colWidth = (WIDTH - 80 - 20) / 2; // 40px margins + 20px divider gap
  const headerY = 90;
  const listTop = 140;
  const lineHeight = 42;
  const maxEvents = Math.floor((HEIGHT - listTop - 20) / lineHeight);

  for (let col = 0; col < 2; col++) {
    const x = 40 + col * (colWidth + 20);
    const dateKey = keys[col];
    if (!dateKey) continue;

    const events = buckets.get(dateKey) ?? [];

    // Column header
    const date = new Date(dateKey + "T12:00:00");
    const dayLabel =
      col === 0
        ? "Today"
        : "Tomorrow";
    const dateLabel = date.toLocaleDateString("en-GB", {
      timeZone: tz,
      weekday: "short",
      day: "numeric",
      month: "short",
    });

    ctx.fillStyle = black;
    ctx.font = "bold 30px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`${dayLabel} — ${dateLabel}`, x, headerY);

    // Divider line under header
    ctx.strokeStyle = black;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, headerY + 38);
    ctx.lineTo(x + colWidth, headerY + 38);
    ctx.stroke();

    if (events.length === 0) {
      ctx.fillStyle = black;
      ctx.font = "italic 24px sans-serif";
      ctx.fillText("No events", x, listTop);
      continue;
    }

    // Event list
    for (let i = 0; i < Math.min(events.length, maxEvents); i++) {
      const evt = events[i];
      const y = listTop + i * lineHeight;

      // Time
      let timeStr: string;
      if (evt.allDay) {
        timeStr = "All day";
      } else {
        timeStr = evt.start.toLocaleTimeString("en-GB", {
          timeZone: tz,
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        });
      }

      ctx.fillStyle = red;
      ctx.font = "bold 22px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(timeStr, x, y);

      // Summary (truncate if too long)
      ctx.fillStyle = black;
      ctx.font = "22px sans-serif";
      const maxTextWidth = colWidth - 110;
      let summary = evt.summary;
      while (ctx.measureText(summary).width > maxTextWidth && summary.length > 3) {
        summary = summary.slice(0, -4) + "...";
      }
      ctx.fillText(summary, x + 100, y);
    }

    if (events.length > maxEvents) {
      ctx.fillStyle = black;
      ctx.font = "italic 20px sans-serif";
      ctx.fillText(
        `+${events.length - maxEvents} more`,
        x,
        listTop + maxEvents * lineHeight,
      );
    }
  }

  // Vertical divider
  ctx.strokeStyle = black;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(WIDTH / 2, headerY);
  ctx.lineTo(WIDTH / 2, HEIGHT - 20);
  ctx.stroke();

  return canvasToFramebuffer(canvas, palette);
}
