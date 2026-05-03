/**
 * Calendar "5day" renderer.
 * Layout: agenda-style list across the next five days.
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

export async function render5Day(
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
  ctx.fillText(`${data.calendarName} — 5-Day Agenda`, 40, 30);

  // Bucket into 5 days
  const buckets = bucketByDay(data.events, tz, 5);
  const keys = [...buckets.keys()];

  let y = 90;
  const lineHeight = 34;
  const maxY = HEIGHT - 30;

  let hasAnyEvents = false;

  for (let d = 0; d < keys.length && y < maxY; d++) {
    const dateKey = keys[d];
    const events = buckets.get(dateKey) ?? [];

    // Day header
    const date = new Date(dateKey + "T12:00:00");
    const dayLabel = date.toLocaleDateString("en-GB", {
      timeZone: tz,
      weekday: "long",
      day: "numeric",
      month: "short",
    });

    ctx.fillStyle = black;
    ctx.font = "bold 26px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(dayLabel, 40, y);
    y += 8;

    // Divider
    ctx.strokeStyle = black;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(40, y + 24);
    ctx.lineTo(WIDTH - 40, y + 24);
    ctx.stroke();
    y += 32;

    if (events.length === 0) {
      ctx.fillStyle = black;
      ctx.font = "italic 22px sans-serif";
      ctx.fillText("No events", 60, y);
      y += lineHeight + 6;
      continue;
    }

    hasAnyEvents = true;

    for (const evt of events) {
      if (y >= maxY) {
        ctx.fillStyle = black;
        ctx.font = "italic 20px sans-serif";
        ctx.fillText("...", 60, y);
        break;
      }

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
      ctx.fillText(timeStr, 60, y);

      // Summary
      ctx.fillStyle = black;
      ctx.font = "22px sans-serif";
      const maxTextWidth = WIDTH - 240;
      let summary = evt.summary;
      while (ctx.measureText(summary).width > maxTextWidth && summary.length > 3) {
        summary = summary.slice(0, -4) + "...";
      }
      ctx.fillText(summary, 180, y);

      y += lineHeight;
    }

    y += 10; // Gap between days
  }

  if (!hasAnyEvents && keys.length > 0) {
    ctx.fillStyle = black;
    ctx.font = "36px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("No events in the next 5 days", WIDTH / 2, HEIGHT / 2);
  }

  return canvasToFramebuffer(canvas, palette);
}
