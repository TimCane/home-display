/**
 * Weather "5day" renderer.
 * Layout: five day forecast cards with high/low + condition icon.
 */

import type { WeatherData } from "../fetch.js";
import { weatherLabel } from "../fetch.js";
import {
  createFrame,
  loadPalette,
  loadTimezone,
  canvasToFramebuffer,
  drawWeatherIcon,
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
  ctx.fillText(`${config.location.name} — 5-Day Forecast`, 40, 30);

  // 5 cards
  const days = data.daily.slice(0, 5);
  const cardWidth = (WIDTH - 80 - 4 * 20) / 5; // 40px margins + 20px gaps
  const cardTop = 100;
  const cardHeight = HEIGHT - 140;

  const unitSymbol = config.units === "imperial" ? "°" : "°";

  for (let i = 0; i < days.length; i++) {
    const day = days[i];
    const x = 40 + i * (cardWidth + 20);

    // Card border
    ctx.strokeStyle = black;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, cardTop, cardWidth, cardHeight);

    // Day name
    const date = new Date(day.date + "T12:00:00");
    const dayName = date.toLocaleDateString("en-GB", {
      timeZone: tz,
      weekday: "short",
    });
    const dateStr = date.toLocaleDateString("en-GB", {
      timeZone: tz,
      day: "numeric",
      month: "short",
    });

    ctx.fillStyle = black;
    ctx.font = "bold 28px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(dayName, x + cardWidth / 2, cardTop + 20);

    ctx.font = "22px sans-serif";
    ctx.fillText(dateStr, x + cardWidth / 2, cardTop + 55);

    // Weather icon
    const { icon } = weatherLabel(day.weatherCode);
    const iconSize = Math.min(cardWidth * 0.6, 100);
    drawWeatherIcon(
      ctx,
      icon,
      x + (cardWidth - iconSize) / 2,
      cardTop + 100,
      iconSize,
      black,
    );

    // Condition label
    const { label } = weatherLabel(day.weatherCode);
    ctx.font = "20px sans-serif";
    ctx.fillText(label, x + cardWidth / 2, cardTop + 100 + iconSize + 15);

    // High / Low
    ctx.font = "bold 30px sans-serif";
    ctx.fillStyle = red;
    ctx.fillText(
      `${Math.round(day.high)}${unitSymbol}`,
      x + cardWidth / 2,
      cardTop + cardHeight - 110,
    );

    ctx.fillStyle = black;
    ctx.font = "26px sans-serif";
    ctx.fillText(
      `${Math.round(day.low)}${unitSymbol}`,
      x + cardWidth / 2,
      cardTop + cardHeight - 70,
    );
  }

  if (days.length === 0) {
    ctx.fillStyle = black;
    ctx.font = "36px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("No forecast data available", WIDTH / 2, HEIGHT / 2);
  }

  return canvasToFramebuffer(canvas, palette);
}
