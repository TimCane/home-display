/**
 * Holiday weather renderer — vibrant card grid of upcoming trips.
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

  // ── Header bar (0-80) with decorative accent ──
  drawHeaderBar(ctx, 0, 80, BLACK);
  // Yellow accent stripe at bottom of header
  ctx.fillStyle = YELLOW;
  ctx.fillRect(0, 74, WIDTH, 6);

  ctx.fillStyle = WHITE;
  ctx.font = "bold 34px Inter";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("✈  Upcoming Trips", 40, 38);

  // Decorative dots in header
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.arc(WIDTH - 50 - i * 28, 38, 5, 0, Math.PI * 2);
    ctx.fillStyle = i % 2 === 0 ? YELLOW : RED;
    ctx.fill();
  }

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
  const gap = 28;
  const margin = 36;
  const headerH = 80;
  const availW = WIDTH - margin * 2;
  const availH = HEIGHT - headerH - margin - 10;

  let cols: number;
  let rows: number;
  if (trips.length === 1) {
    cols = 1;
    rows = 1;
  } else if (trips.length <= 3) {
    cols = trips.length;
    rows = 1;
  } else {
    cols = 2;
    rows = 2;
  }

  const cardW = (availW - (cols - 1) * gap) / cols;
  const cardH = (availH - (rows - 1) * gap) / rows;
  const radius = 16;

  for (let i = 0; i < trips.length; i++) {
    const trip = trips[i];
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = margin + col * (cardW + gap);
    const y = headerH + 16 + row * (cardH + gap);
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
  const cardHeaderH = 70;

  // ── Card shell: thick border for first card ──
  roundedRectPath(ctx, x, y, w, h, radius);
  ctx.fillStyle = WHITE;
  ctx.fill();
  ctx.strokeStyle = BLACK;
  ctx.lineWidth = isFirst ? 4 : 2;
  ctx.stroke();

  // ── Card header with colour fill ──
  ctx.save();
  roundedRectPath(ctx, x, y, w, cardHeaderH + radius, radius);
  ctx.clip();
  ctx.fillStyle = isFirst ? YELLOW : BLACK;
  ctx.fillRect(x, y, w, cardHeaderH);

  // Diagonal decorative stripes in header
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = isFirst ? BLACK : WHITE;
  for (let s = -2; s < 8; s++) {
    ctx.beginPath();
    ctx.moveTo(x + s * 40, y);
    ctx.lineTo(x + s * 40 + 20, y);
    ctx.lineTo(x + s * 40 + 20 + cardHeaderH, y + cardHeaderH);
    ctx.lineTo(x + s * 40 + cardHeaderH, y + cardHeaderH);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalAlpha = 1.0;
  ctx.restore();

  // Header border bottom
  ctx.strokeStyle = BLACK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y + cardHeaderH);
  ctx.lineTo(x + w, y + cardHeaderH);
  ctx.stroke();

  // ── Trip name (big, bold) ──
  const headerTextColor = isFirst ? BLACK : WHITE;
  ctx.fillStyle = headerTextColor;
  ctx.font = "bold 28px Inter";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const tripName = truncateText(ctx, trip.name.toUpperCase(), w - 30);
  ctx.fillText(tripName, x + w / 2, y + cardHeaderH / 2);

  // ── Card body ──
  const bodyTop = y + cardHeaderH + 14;
  const bodyBottom = y + h - 14;
  const bodyH = bodyBottom - bodyTop;
  const cx = x + w / 2;

  if (trip.weather) {
    // Weather icon — large and prominent
    const { icon, label } = weatherLabel(trip.weather.weatherCode);
    const iconSize = Math.min(w * 0.38, bodyH * 0.32, 120);
    drawWeatherIcon(ctx, icon, cx - iconSize / 2, bodyTop + 6, iconSize, BLACK);

    // Condition label
    ctx.fillStyle = BLACK;
    ctx.font = "18px Inter";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(label, cx, bodyTop + iconSize + 10);

    // Temperature — big red high, smaller low
    const tempY = bodyTop + iconSize + 36;
    ctx.fillStyle = RED;
    ctx.font = "bold 48px Inter";
    ctx.textBaseline = "top";
    ctx.fillText(`${trip.weather.high}°`, cx, tempY);

    ctx.fillStyle = BLACK;
    ctx.font = "28px Inter";
    ctx.fillText(`/ ${trip.weather.low}°`, cx, tempY + 52);

    // Countdown pill
    drawCountdownPill(ctx, cx, bodyBottom - 88, trip.daysUntil);
  } else {
    // No forecast — dramatic countdown display
    const countdownCenterY = bodyTop + bodyH * 0.3;

    // Large number in a coloured circle
    const circleR = Math.min(w * 0.22, bodyH * 0.22, 70);
    ctx.beginPath();
    ctx.arc(cx, countdownCenterY, circleR, 0, Math.PI * 2);
    ctx.fillStyle = isFirst ? YELLOW : RED;
    ctx.fill();
    ctx.strokeStyle = BLACK;
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = isFirst ? BLACK : WHITE;
    ctx.font = `bold ${circleR * 0.9}px Inter`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${trip.daysUntil}`, cx, countdownCenterY);

    // "days to go" label
    ctx.fillStyle = BLACK;
    ctx.font = "bold 22px Inter";
    ctx.textBaseline = "top";
    ctx.fillText("days to go", cx, countdownCenterY + circleR + 12);

    // Progress bar showing how close the trip is (90 days = full track)
    const progressY = countdownCenterY + circleR + 50;
    drawProgressBar(ctx, x + 20, progressY, w - 40, trip.daysUntil);
  }

  // ── Bottom section: location + dates ──
  const footerH = 65;
  const footerY = y + h - footerH;

  // Footer separator with yellow accent
  ctx.fillStyle = YELLOW;
  ctx.fillRect(x + 14, footerY, w - 28, 3);

  // Location name
  ctx.fillStyle = BLACK;
  ctx.font = "bold 20px Inter";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  const locName = truncateText(ctx, trip.locationName, w - 30);
  ctx.fillText(locName, cx, footerY + 10);

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
  ctx.fillText(dateRange, cx, footerY + 36);
}

function drawCountdownPill(
  ctx: SKRSContext2D,
  cx: number,
  y: number,
  daysUntil: number,
): void {
  let pillText: string;
  let bgColor: string;
  let textColor: string;

  if (daysUntil === 0) {
    pillText = "✈  TODAY!";
    bgColor = YELLOW;
    textColor = BLACK;
  } else if (daysUntil === 1) {
    pillText = "✈  TOMORROW!";
    bgColor = YELLOW;
    textColor = BLACK;
  } else if (daysUntil <= 7) {
    pillText = `${daysUntil} days — this week!`;
    bgColor = RED;
    textColor = WHITE;
  } else {
    pillText = `in ${daysUntil} days`;
    bgColor = RED;
    textColor = WHITE;
  }

  ctx.font = "bold 18px Inter";
  const pillW = Math.max(ctx.measureText(pillText).width + 28, 100);
  const pillH = 30;
  const pillX = cx - pillW / 2;

  roundedRectPath(ctx, pillX, y, pillW, pillH, pillH / 2);
  ctx.fillStyle = bgColor;
  ctx.fill();

  ctx.fillStyle = textColor;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(pillText, cx, y + pillH / 2);
}

function drawProgressBar(
  ctx: SKRSContext2D,
  x: number,
  y: number,
  w: number,
  daysUntil: number,
): void {
  const barH = 10;
  const maxDays = 90;
  const progress = Math.max(0, Math.min(1, 1 - daysUntil / maxDays));

  // Track
  roundedRectPath(ctx, x, y, w, barH, barH / 2);
  ctx.fillStyle = BLACK;
  ctx.fill();

  // Filled portion
  if (progress > 0.02) {
    const fillW = Math.max(barH, progress * w);
    roundedRectPath(ctx, x, y, fillW, barH, barH / 2);
    ctx.fillStyle = YELLOW;
    ctx.fill();
  }

  // Marker dot at the progress point
  const dotX = x + progress * w;
  ctx.beginPath();
  ctx.arc(dotX, y + barH / 2, 7, 0, Math.PI * 2);
  ctx.fillStyle = RED;
  ctx.fill();
  ctx.strokeStyle = BLACK;
  ctx.lineWidth = 2;
  ctx.stroke();
}
