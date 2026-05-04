/**
 * Calendar "5day" renderer.
 * Layout: yellow header bar, structured day sections with accent bars.
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

export async function render5Day(
  data: CalendarData,
  _config: CalendarConfig,
): Promise<Uint8Array> {
  const palette = await loadPalette();
  const tz = await loadTimezone();
  const canvas = createFrame();
  const ctx = canvas.getContext("2d");

  const leftMargin = 36;
  const rightMargin = WIDTH - 36;
  const contentW = rightMargin - leftMargin;

  // ── Background ──
  ctx.fillStyle = WHITE;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // ── Header bar (0-60) ──
  drawHeaderBar(ctx, 0, 60, YELLOW);
  ctx.fillStyle = BLACK;
  ctx.font = "bold 28px Inter";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(`${data.calendarName} — 5-Day Agenda`, 40, 31);

  // ── Day sections ──
  const buckets = bucketByDay(data.events, tz, 5);
  const keys = [...buckets.keys()];

  const dayHeaderH = 40;
  const eventRowH = 38;
  const dayGap = 10;
  const maxY = HEIGHT - 16;

  // Pre-calculate to determine per-day event cap
  const totalEvents = keys.reduce(
    (sum, k) => sum + (buckets.get(k)?.length ?? 0), 0,
  );
  const usableH = maxY - 72; // below header
  const headersH = keys.length * (dayHeaderH + dayGap);
  const availableForEvents = usableH - headersH;
  const daysWithEvents = keys.filter(
    (k) => (buckets.get(k)?.length ?? 0) > 0,
  ).length;
  const perDayCap = daysWithEvents > 0
    ? Math.max(2, Math.floor(availableForEvents / eventRowH / daysWithEvents))
    : 5;

  let y = 72;
  let hasAnyEvents = false;

  for (let d = 0; d < keys.length && y < maxY; d++) {
    const dateKey = keys[d];
    const events = buckets.get(dateKey) ?? [];

    // Day header — black rounded rect
    const date = new Date(dateKey + "T12:00:00");
    const dayLabel = date.toLocaleDateString("en-GB", {
      timeZone: tz,
      weekday: "long",
      day: "numeric",
      month: "short",
    });

    roundedRectPath(ctx, leftMargin, y, contentW, dayHeaderH, 8);
    ctx.fillStyle = BLACK;
    ctx.fill();

    // Day name (white)
    ctx.fillStyle = WHITE;
    ctx.font = "bold 22px Inter";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(dayLabel, leftMargin + 16, y + dayHeaderH / 2);

    // Event count badge (yellow pill on right side)
    if (events.length > 0) {
      const countText = `${events.length} event${events.length > 1 ? "s" : ""}`;
      ctx.font = "bold 16px Inter";
      const countW = ctx.measureText(countText).width + 16;
      const badgeX = rightMargin - countW - 10;
      roundedRectPath(ctx, badgeX, y + 8, countW, 24, 12);
      ctx.fillStyle = YELLOW;
      ctx.fill();
      ctx.fillStyle = BLACK;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(countText, badgeX + countW / 2, y + 20);
    }

    y += dayHeaderH + 6;

    if (events.length === 0) {
      ctx.fillStyle = BLACK;
      ctx.font = "italic 20px Inter";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText("No events", leftMargin + 20, y);
      y += eventRowH;
      y += dayGap;
      continue;
    }

    hasAnyEvents = true;
    const visibleCount = Math.min(events.length, perDayCap);

    for (let i = 0; i < visibleCount && y < maxY; i++) {
      const evt = events[i];

      // Red accent bar
      ctx.fillStyle = RED;
      ctx.fillRect(leftMargin + 8, y + 4, 4, eventRowH - 10);

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

      ctx.fillStyle = RED;
      ctx.font = "bold 20px Inter";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(timeStr, leftMargin + 22, y + 6);

      // Summary
      ctx.fillStyle = BLACK;
      ctx.font = "20px Inter";
      const summaryX = leftMargin + 140;
      const maxTextW = rightMargin - summaryX - 8;
      const summary = truncateText(ctx, evt.summary, maxTextW);
      ctx.fillText(summary, summaryX, y + 6);

      // Separator
      if (i < visibleCount - 1) {
        ctx.strokeStyle = BLACK;
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(leftMargin + 18, y + eventRowH - 2);
        ctx.lineTo(rightMargin - 8, y + eventRowH - 2);
        ctx.stroke();
      }

      y += eventRowH;
    }

    // Overflow
    if (events.length > visibleCount) {
      ctx.fillStyle = BLACK;
      ctx.font = "italic 18px Inter";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(
        `+${events.length - visibleCount} more`,
        leftMargin + 22,
        y + 2,
      );
      y += 24;
    }

    y += dayGap;
  }

  if (!hasAnyEvents && keys.length > 0) {
    ctx.fillStyle = BLACK;
    ctx.font = "36px Inter";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("No events in the next 5 days", WIDTH / 2, HEIGHT / 2);
  }

  return canvasToFramebuffer(canvas, palette);
}
