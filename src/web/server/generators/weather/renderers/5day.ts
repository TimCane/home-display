/**
 * Weather "5day" renderer.
 * Layout: black header bar, five rounded cards with coloured headers.
 */

import type { WeatherData } from "../fetch.js";
import { weatherLabel } from "../fetch.js";
import {
  createFrame,
  loadPalette,
  loadTimezone,
  canvasToFramebuffer,
  drawWeatherIcon,
  drawHeaderBar,
  roundedRectPath,
  BLACK, WHITE, YELLOW, RED,
} from "../../render-utils.js";
import { WIDTH, HEIGHT } from "../../../../shared/framebuffer.js";

interface WeatherConfig {
  location: { lat: number; lon: number; name: string };
  units: "metric" | "imperial";
}

export async function render5Day(
  data: WeatherData,
  config: WeatherConfig,
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
  ctx.fillText("5-Day Forecast", 40, 33);
  ctx.font = "22px Inter";
  ctx.textAlign = "right";
  ctx.fillText(config.location.name, WIDTH - 40, 33);

  // ��─ Cards ──
  const days = data.daily.slice(0, 5);
  const gap = 16;
  const margin = 40;
  const cardW = (WIDTH - margin * 2 - gap * 4) / 5;
  const cardTop = 85;
  const cardH = HEIGHT - cardTop - 20;
  const headerH = 80;
  const radius = 12;

  // Find global temp range for comparison bars
  let globalMin = Infinity;
  let globalMax = -Infinity;
  for (const d of days) {
    if (d.low < globalMin) globalMin = d.low;
    if (d.high > globalMax) globalMax = d.high;
  }
  const tempRange = globalMax - globalMin || 1;

  for (let i = 0; i < days.length; i++) {
    const day = days[i];
    const x = margin + i * (cardW + gap);
    const isToday = i === 0;

    // Card background (white rounded rect)
    roundedRectPath(ctx, x, cardTop, cardW, cardH, radius);
    ctx.fillStyle = WHITE;
    ctx.fill();
    ctx.strokeStyle = BLACK;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Card header — yellow for today, black for others
    ctx.save();
    roundedRectPath(ctx, x, cardTop, cardW, headerH + radius, radius);
    ctx.clip();
    ctx.fillStyle = isToday ? YELLOW : BLACK;
    ctx.fillRect(x, cardTop, cardW, headerH);
    ctx.restore();

    // Separator line under header
    ctx.strokeStyle = BLACK;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, cardTop + headerH);
    ctx.lineTo(x + cardW, cardTop + headerH);
    ctx.stroke();

    // Day name + date
    const date = new Date(day.date + "T12:00:00");
    const dayName = date.toLocaleDateString("en-GB", {
      timeZone: tz,
      weekday: "short",
    }).toUpperCase();
    const dateStr = date.toLocaleDateString("en-GB", {
      timeZone: tz,
      day: "numeric",
      month: "short",
    });

    const headerTextColor = isToday ? BLACK : WHITE;
    ctx.fillStyle = headerTextColor;
    ctx.font = "bold 26px Inter";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(dayName, x + cardW / 2, cardTop + 14);
    ctx.font = "20px Inter";
    ctx.fillText(dateStr, x + cardW / 2, cardTop + 46);

    // Weather icon
    const { icon, label } = weatherLabel(day.weatherCode);
    const iconSize = Math.min(cardW * 0.55, 90);
    drawWeatherIcon(
      ctx, icon,
      x + (cardW - iconSize) / 2,
      cardTop + headerH + 16,
      iconSize,
      BLACK,
    );

    // Condition label
    ctx.fillStyle = BLACK;
    ctx.font = "18px Inter";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(label, x + cardW / 2, cardTop + headerH + 20 + iconSize + 8);

    // Separator
    const sepY = cardTop + headerH + iconSize + 60;
    ctx.strokeStyle = BLACK;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 12, sepY);
    ctx.lineTo(x + cardW - 12, sepY);
    ctx.stroke();

    // High temp (red)
    ctx.fillStyle = RED;
    ctx.font = "bold 36px Inter";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(`${Math.round(day.high)}°`, x + cardW / 2, sepY + 14);

    // Low temp (black)
    ctx.fillStyle = BLACK;
    ctx.font = "26px Inter";
    ctx.fillText(`${Math.round(day.low)}°`, x + cardW / 2, sepY + 56);

    // Temperature range bar at bottom of card
    const barX = x + 16;
    const barW = cardW - 32;
    const barY = cardTop + cardH - 30;
    const barH = 8;

    // Track background
    roundedRectPath(ctx, barX, barY, barW, barH, barH / 2);
    ctx.fillStyle = BLACK;
    ctx.fill();

    // Filled portion (low to high, proportional to global range)
    const lowFrac = (day.low - globalMin) / tempRange;
    const highFrac = (day.high - globalMin) / tempRange;
    const fillX = barX + lowFrac * barW;
    const fillW = Math.max(barH, (highFrac - lowFrac) * barW);
    roundedRectPath(ctx, fillX, barY, fillW, barH, barH / 2);
    ctx.fillStyle = RED;
    ctx.fill();
  }

  if (days.length === 0) {
    ctx.fillStyle = BLACK;
    ctx.font = "36px Inter";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("No forecast data available", WIDTH / 2, HEIGHT / 2);
  }

  return canvasToFramebuffer(canvas, palette);
}
