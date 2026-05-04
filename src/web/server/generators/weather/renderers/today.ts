/**
 * Weather "today" renderer.
 * Layout: current temp (big), condition icon + label, high/low, hourly temp curve.
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

export async function renderToday(
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

  // Location name
  ctx.fillStyle = black;
  ctx.font = "bold 36px Inter";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(config.location.name, 40, 30);

  // Current temperature (big)
  const unitSymbol = config.units === "imperial" ? "°F" : "°C";
  ctx.font = "bold 140px Inter";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(`${Math.round(data.current.temperature)}${unitSymbol}`, 40, 80);

  // Weather condition icon + label
  const { label, icon } = weatherLabel(data.current.weatherCode);
  drawWeatherIcon(ctx, icon, 560, 80, 120, black);
  ctx.font = "bold 36px Inter";
  ctx.textAlign = "center";
  ctx.fillText(label, 620, 210);

  // High / Low
  ctx.font = "32px Inter";
  ctx.textAlign = "left";
  ctx.fillStyle = red;
  ctx.fillText(`H: ${Math.round(data.today.high)}°`, 560, 270);
  ctx.fillStyle = black;
  ctx.fillText(`L: ${Math.round(data.today.low)}°`, 720, 270);

  // Date
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-GB", {
    timeZone: tz,
    weekday: "long",
    day: "numeric",
    month: "short",
  });
  ctx.fillStyle = black;
  ctx.font = "28px Inter";
  ctx.textAlign = "left";
  ctx.fillText(dateStr, 560, 320);

  // Hourly temperature curve
  const curveTop = 400;
  const curveBottom = 620;
  const curveLeft = 60;
  const curveRight = WIDTH - 60;

  // Draw axis
  ctx.strokeStyle = black;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(curveLeft, curveBottom);
  ctx.lineTo(curveRight, curveBottom);
  ctx.stroke();

  if (data.hourly.length > 1) {
    const temps = data.hourly.map((h) => h.temperature);
    const minT = Math.min(...temps) - 2;
    const maxT = Math.max(...temps) + 2;
    const range = maxT - minT || 1;
    const step = (curveRight - curveLeft) / (data.hourly.length - 1);

    // Draw curve
    ctx.strokeStyle = black;
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i < data.hourly.length; i++) {
      const x = curveLeft + i * step;
      const y =
        curveBottom -
        ((temps[i] - minT) / range) * (curveBottom - curveTop);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Hour labels (every 3 hours)
    ctx.fillStyle = black;
    ctx.font = "20px Inter";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    for (let i = 0; i < data.hourly.length; i += 3) {
      const x = curveLeft + i * step;
      const h = data.hourly[i].hour;
      ctx.fillText(`${h}:00`, x, curveBottom + 8);
    }

    // Temp labels at start and end
    ctx.textBaseline = "bottom";
    const firstY =
      curveBottom - ((temps[0] - minT) / range) * (curveBottom - curveTop);
    ctx.fillText(`${Math.round(temps[0])}°`, curveLeft, firstY - 8);
    const lastY =
      curveBottom -
      ((temps[temps.length - 1] - minT) / range) * (curveBottom - curveTop);
    ctx.fillText(
      `${Math.round(temps[temps.length - 1])}°`,
      curveRight,
      lastY - 8,
    );
  }

  // "Hourly" label
  ctx.fillStyle = black;
  ctx.font = "bold 26px Inter";
  ctx.textAlign = "left";
  ctx.textBaseline = "bottom";
  ctx.fillText("Hourly Forecast", curveLeft, curveTop - 10);

  return canvasToFramebuffer(canvas, palette);
}
