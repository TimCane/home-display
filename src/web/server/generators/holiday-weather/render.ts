/**
 * Holiday weather renderer — card grid of upcoming trips.
 */

import type { SKRSContext2D } from "@napi-rs/canvas";
import type { HolidayData } from "./fetch.js";
import { weatherLabel } from "../weather/fetch.js";
import {
  createFrame,
  loadPalette,
  loadTimezone,
  canvasToFramebuffer,
  drawWeatherIcon,
  drawHeaderBar,
  roundedRectPath,
  truncateText,
  BLACK, WHITE, YELLOW, RED,
} from "../render-utils.js";
import { WIDTH, HEIGHT } from "../../../shared/framebuffer.js";

interface HolidayConfig {
  trips: unknown[];
  units: "metric" | "imperial";
}

export async function renderHoliday(
  data: HolidayData,
  _config: HolidayConfig,
): Promise<Uint8Array> {
  const palette = await loadPalette();
  const tz = await loadTimezone();
  const canvas = createFrame();
  const ctx = canvas.getContext("2d");

  // ── Background ──
  ctx.fillStyle = WHITE;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // ── Header bar (0-65) ──
  drawHeaderBar(ctx, 0, 65, BLACK);
  ctx.fillStyle = WHITE;
  ctx.font = "bold 30px Inter";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("Upcoming Trips", 40, 33);

  const trips = data.trips;

  if (trips.length === 0) {
    ctx.fillStyle = BLACK;
    ctx.font = "36px Inter";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("No upcoming trips", WIDTH / 2, HEIGHT / 2);
    return canvasToFramebuffer(canvas, palette);
  }

  // ── Card layout ──
  // 1 trip: 1 large centred card
  // 2 trips: 2 cards in a row
  // 3 trips: 3 cards in a row
  // 4 trips: 2x2 grid
  const gap = 24;
  const margin = 40;
  const headerH = 65;
  const availW = WIDTH - margin * 2;
  const availH = HEIGHT - headerH - margin;

  let cols: number;
  let rows: number;
  if (trips.length <= 3) {
    cols = trips.length;
    rows = 1;
  } else {
    cols = 2;
    rows = 2;
  }

  const cardW = (availW - (cols - 1) * gap) / cols;
  const cardH = (availH - (rows - 1) * gap) / rows;
  const radius = 14;

  for (let i = 0; i < trips.length; i++) {
    const trip = trips[i];
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = margin + col * (cardW + gap);
    const y = headerH + margin / 2 + row * (cardH + gap);
    const isFirst = i === 0;

    drawTripCard(ctx, trip, x, y, cardW, cardH, radius, isFirst, tz);
  }

  return canvasToFramebuffer(canvas, palette);
}

function drawTripCard(
  ctx: SKRSContext2D,
  trip: HolidayData["trips"][number],
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
  isFirst: boolean,
  tz: string,
): void {
  const cardHeaderH = 60;

  // Card background
  roundedRectPath(ctx, x, y, w, h, radius);
  ctx.fillStyle = WHITE;
  ctx.fill();
  ctx.strokeStyle = BLACK;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Card header — yellow for soonest, black for others
  ctx.save();
  roundedRectPath(ctx, x, y, w, cardHeaderH + radius, radius);
  ctx.clip();
  ctx.fillStyle = isFirst ? YELLOW : BLACK;
  ctx.fillRect(x, y, w, cardHeaderH);
  ctx.restore();

  // Header separator
  ctx.strokeStyle = BLACK;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y + cardHeaderH);
  ctx.lineTo(x + w, y + cardHeaderH);
  ctx.stroke();

  // Trip name in header
  const headerTextColor = isFirst ? BLACK : WHITE;
  ctx.fillStyle = headerTextColor;
  ctx.font = "bold 26px Inter";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const tripName = truncateText(ctx, trip.name, w - 24);
  ctx.fillText(tripName, x + w / 2, y + cardHeaderH / 2);

  // ── Card body ──
  const bodyTop = y + cardHeaderH + 12;
  const bodyH = h - cardHeaderH - 12;
  const cx = x + w / 2;

  if (trip.weather) {
    // Weather icon
    const { icon } = weatherLabel(trip.weather.weatherCode);
    const iconSize = Math.min(w * 0.35, bodyH * 0.35, 110);
    drawWeatherIcon(ctx, icon, cx - iconSize / 2, bodyTop + 4, iconSize, BLACK);

    // Temperature
    const tempY = bodyTop + iconSize + 14;
    ctx.fillStyle = RED;
    ctx.font = "bold 40px Inter";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(`${trip.weather.high}°`, cx, tempY);

    ctx.fillStyle = BLACK;
    ctx.font = "26px Inter";
    ctx.fillText(`${trip.weather.low}°`, cx, tempY + 44);
  } else {
    // No forecast — show a large countdown number
    ctx.fillStyle = BLACK;
    ctx.font = "bold 80px Inter";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    const countdownTop = bodyTop + bodyH * 0.05;
    ctx.fillText(`${trip.daysUntil}`, cx, countdownTop);

    ctx.font = "22px Inter";
    ctx.fillText("days to go", cx, countdownTop + 85);
  }

  // ── Bottom section: location, dates, countdown pill ──
  const bottomY = y + h - 100;

  // Separator
  ctx.strokeStyle = BLACK;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + 14, bottomY);
  ctx.lineTo(x + w - 14, bottomY);
  ctx.stroke();

  // Location name
  ctx.fillStyle = BLACK;
  ctx.font = "20px Inter";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  const locName = truncateText(ctx, trip.locationName, w - 28);
  ctx.fillText(locName, cx, bottomY + 8);

  // Date range
  const startD = new Date(trip.startDate + "T12:00:00");
  const endD = new Date(trip.endDate + "T12:00:00");
  const fmtOpts: Intl.DateTimeFormatOptions = {
    timeZone: tz,
    day: "numeric",
    month: "short",
  };
  const dateRange = `${startD.toLocaleDateString("en-GB", fmtOpts)} – ${endD.toLocaleDateString("en-GB", fmtOpts)}`;
  ctx.font = "18px Inter";
  ctx.fillText(dateRange, cx, bottomY + 33);

  // Countdown pill (if forecast is available — otherwise it's shown large above)
  if (trip.weather && trip.daysUntil > 0) {
    const pillText = `in ${trip.daysUntil} day${trip.daysUntil !== 1 ? "s" : ""}`;
    ctx.font = "bold 16px Inter";
    const pillW = ctx.measureText(pillText).width + 20;
    const pillX = cx - pillW / 2;
    const pillY = bottomY + 58;
    roundedRectPath(ctx, pillX, pillY, pillW, 24, 12);
    ctx.fillStyle = RED;
    ctx.fill();
    ctx.fillStyle = WHITE;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(pillText, cx, pillY + 12);
  } else if (trip.daysUntil === 0) {
    const pillText = "TODAY!";
    ctx.font = "bold 16px Inter";
    const pillW = ctx.measureText(pillText).width + 20;
    const pillX = cx - pillW / 2;
    const pillY = bottomY + 58;
    roundedRectPath(ctx, pillX, pillY, pillW, 24, 12);
    ctx.fillStyle = YELLOW;
    ctx.fill();
    ctx.fillStyle = BLACK;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(pillText, cx, pillY + 12);
  }
}
