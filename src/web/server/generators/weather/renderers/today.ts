/**
 * Weather "today" renderer.
 * Layout: black header bar, current conditions panel, hourly area chart.
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
  drawFilledAreaChart,
  roundedRectPath,
  BLACK, WHITE, YELLOW, RED,
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

  // ── Background ──
  ctx.fillStyle = WHITE;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // ── Header bar (0-70) ──
  drawHeaderBar(ctx, 0, 70, BLACK);
  ctx.fillStyle = WHITE;
  ctx.font = "bold 32px Inter";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(config.location.name, 40, 36);

  const now = new Date();
  const dateStr = now.toLocaleDateString("en-GB", {
    timeZone: tz,
    weekday: "long",
    day: "numeric",
    month: "short",
  });
  ctx.font = "24px Inter";
  ctx.textAlign = "right";
  ctx.fillText(dateStr, WIDTH - 40, 36);

  // ── Current conditions (80-360) ──
  const unitSymbol = config.units === "imperial" ? "°F" : "°C";

  // Big temperature
  ctx.fillStyle = BLACK;
  ctx.font = "bold 150px Inter";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(`${Math.round(data.current.temperature)}${unitSymbol}`, 40, 90);

  // High/Low — red pill for high, plain for low
  const highText = `H: ${Math.round(data.today.high)}°`;
  const lowText = `L: ${Math.round(data.today.low)}°`;

  ctx.font = "bold 26px Inter";
  const highW = ctx.measureText(highText).width + 24;
  roundedRectPath(ctx, 44, 280, highW, 38, 19);
  ctx.fillStyle = RED;
  ctx.fill();
  ctx.fillStyle = WHITE;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(highText, 56, 300);

  ctx.fillStyle = BLACK;
  ctx.fillText(lowText, 60 + highW + 16, 300);

  // Weather icon (right side)
  const { label, icon } = weatherLabel(data.current.weatherCode);
  drawWeatherIcon(ctx, icon, 560, 95, 160, BLACK);

  // Condition label
  ctx.fillStyle = BLACK;
  ctx.font = "bold 32px Inter";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText(label, 640, 265);

  // Yellow accent line under label
  ctx.fillStyle = YELLOW;
  ctx.fillRect(580, 305, 120, 3);

  // ── Hourly forecast (370-665) ──
  const curveTop = 420;
  const curveBottom = 635;
  const curveLeft = 80;
  const curveRight = WIDTH - 60;

  // Section label with yellow accent bar
  ctx.fillStyle = YELLOW;
  ctx.fillRect(48, 378, 5, 22);
  ctx.fillStyle = BLACK;
  ctx.font = "bold 22px Inter";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText("HOURLY FORECAST", 62, 378);

  if (data.hourly.length > 1) {
    const temps = data.hourly.map((h) => h.temperature);
    const minT = Math.min(...temps) - 2;
    const maxT = Math.max(...temps) + 2;
    const range = maxT - minT || 1;
    const step = (curveRight - curveLeft) / (data.hourly.length - 1);

    // Dashed grid lines
    ctx.strokeStyle = BLACK;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 6]);
    for (const frac of [0.25, 0.5, 0.75]) {
      const gy = curveBottom - frac * (curveBottom - curveTop);
      ctx.beginPath();
      ctx.moveTo(curveLeft, gy);
      ctx.lineTo(curveRight, gy);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Baseline
    ctx.strokeStyle = BLACK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(curveLeft, curveBottom);
    ctx.lineTo(curveRight, curveBottom);
    ctx.stroke();

    // Build points
    const points = temps.map((t, i) => ({
      x: curveLeft + i * step,
      y: curveBottom - ((t - minT) / range) * (curveBottom - curveTop),
    }));

    // Filled area chart
    drawFilledAreaChart(ctx, points, curveBottom, {
      fillColor: YELLOW,
      strokeColor: BLACK,
      dotColor: RED,
      lineWidth: 3,
      dotRadius: 5,
      dotEvery: 3,
    });

    // Temperature labels at dot positions
    ctx.fillStyle = BLACK;
    ctx.font = "bold 18px Inter";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    for (let i = 0; i < points.length; i += 3) {
      ctx.fillText(`${Math.round(temps[i])}°`, points[i].x, points[i].y - 10);
    }

    // Hour labels below baseline
    ctx.fillStyle = BLACK;
    ctx.font = "18px Inter";
    ctx.textBaseline = "top";
    for (let i = 0; i < data.hourly.length; i += 3) {
      const hx = curveLeft + i * step;
      ctx.fillText(`${data.hourly[i].hour}:00`, hx, curveBottom + 6);
    }
  }

  return canvasToFramebuffer(canvas, palette);
}
