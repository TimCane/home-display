/**
 * Pollen & Air Quality "today" renderer.
 * Layout: black header bar, AQI hero card with gauge, pollen bar chart.
 */

import type { PollenAqiData } from "../fetch.js";
import {
  createFrame,
  loadPalette,
  canvasToFramebuffer,
  drawHeaderBar,
  roundedRectPath,
  truncateText,
  BLACK,
  WHITE,
  YELLOW,
  RED,
} from "../../render-utils.js";
import { WIDTH } from "../../../../shared/framebuffer.js";

interface PollenAqiConfig {
  location: { name: string };
}

export async function renderToday(
  data: PollenAqiData,
  config: PollenAqiConfig,
): Promise<Uint8Array> {
  const palette = await loadPalette();
  const canvas = createFrame();
  const ctx = canvas.getContext("2d");

  // ── Background ──
  ctx.fillStyle = WHITE;
  ctx.fillRect(0, 0, 960, 680);

  // ── Header bar (0-70) ──
  drawHeaderBar(ctx, 0, 70, BLACK);

  ctx.fillStyle = WHITE;
  ctx.font = "bold 32px Inter";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("AIR QUALITY", 40, 36);

  ctx.font = "24px Inter";
  ctx.textAlign = "right";
  ctx.fillText(truncateText(ctx, config.location.name, 400), WIDTH - 40, 36);

  // Yellow accent stripe
  ctx.fillStyle = YELLOW;
  ctx.fillRect(0, 70, WIDTH, 3);

  // ── AQI hero section (y=90 to y=340) ──
  const cardW = 400;
  const cardH = 160;
  const cardX = (WIDTH - cardW) / 2;
  const cardY = 90;

  // Card border color
  const aqiVal = data.aqi.value;
  let borderColor = BLACK;
  if (aqiVal > 60) borderColor = RED;
  else if (aqiVal > 40) borderColor = YELLOW;

  // Card background
  roundedRectPath(ctx, cardX, cardY, cardW, cardH, 12);
  ctx.fillStyle = WHITE;
  ctx.fill();
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 4;
  ctx.stroke();

  // AQI number centered in card
  ctx.fillStyle = BLACK;
  ctx.font = "bold 64px Inter";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(Math.round(aqiVal)), WIDTH / 2, cardY + 70);

  // Label below number
  ctx.font = "bold 28px Inter";
  ctx.fillText(data.aqi.label.toUpperCase(), WIDTH / 2, cardY + 125);

  // ── AQI gauge bar ──
  const gaugeX = 80;
  const gaugeEndX = 880;
  const gaugeW = gaugeEndX - gaugeX;
  const gaugeY = 275;
  const gaugeH = 14;

  // Track
  roundedRectPath(ctx, gaugeX, gaugeY, gaugeW, gaugeH, gaugeH / 2);
  ctx.fillStyle = BLACK;
  ctx.fill();

  // Filled portion — cap at 120 for display
  const maxAqi = 120;
  const fillFrac = Math.min(aqiVal / maxAqi, 1);
  const fillW = Math.max(gaugeH, fillFrac * gaugeW);
  const fillColor = aqiVal <= 40 ? YELLOW : RED;

  roundedRectPath(ctx, gaugeX, gaugeY, fillW, gaugeH, gaugeH / 2);
  ctx.fillStyle = fillColor;
  ctx.fill();

  // Marker dot at current position
  const markerX = gaugeX + fillFrac * gaugeW;
  ctx.beginPath();
  ctx.arc(markerX, gaugeY + gaugeH / 2, 8, 0, Math.PI * 2);
  ctx.fillStyle = RED;
  ctx.fill();

  // Scale labels
  const scaleLabels = ["Good", "Fair", "Mod", "Poor", "V.Poor"];
  ctx.fillStyle = BLACK;
  ctx.font = "14px Inter";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  const labelSpacing = gaugeW / (scaleLabels.length - 1);
  for (let i = 0; i < scaleLabels.length; i++) {
    ctx.fillText(scaleLabels[i], gaugeX + i * labelSpacing, gaugeY + gaugeH + 6);
  }

  // Pollutant values below gauge
  ctx.fillStyle = BLACK;
  ctx.font = "20px Inter";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  const pm25Text = `PM2.5: ${Math.round(data.pollutants.pm25)} µg/m³`;
  const pm10Text = `PM10: ${Math.round(data.pollutants.pm10)} µg/m³`;
  ctx.fillText(`${pm25Text}    ${pm10Text}`, WIDTH / 2, 320);

  // ── Pollen section (y=370 to y=650) ──

  // Yellow divider line
  ctx.fillStyle = YELLOW;
  ctx.fillRect(80, 360, WIDTH - 160, 3);

  // POLLEN label centered on divider
  ctx.font = "bold 20px Inter";
  const pollenLabelW = ctx.measureText("POLLEN").width + 20;
  ctx.fillStyle = WHITE;
  ctx.fillRect(WIDTH / 2 - pollenLabelW / 2, 349, pollenLabelW, 22);
  ctx.fillStyle = BLACK;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("POLLEN", WIDTH / 2, 361);

  // Collect non-zero pollen entries sorted descending
  const pollenEntries: { name: string; value: number }[] = [
    { name: "Grass", value: data.pollen.grass },
    { name: "Birch", value: data.pollen.birch },
    { name: "Alder", value: data.pollen.alder },
    { name: "Mugwort", value: data.pollen.mugwort },
    { name: "Olive", value: data.pollen.olive },
    { name: "Ragweed", value: data.pollen.ragweed },
  ]
    .filter((e) => e.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 3);

  if (pollenEntries.length === 0) {
    ctx.fillStyle = BLACK;
    ctx.font = "24px Inter";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("No significant pollen", WIDTH / 2, 510);
  } else {
    const barMaxW = 200;
    const barH = 16;
    const rowSpacing = 70;
    const startY = 410;
    const labelX = 80;
    const barX = 260;
    // Use 120 as max for bar scaling
    const maxPollenVal = 120;

    for (let i = 0; i < pollenEntries.length; i++) {
      const entry = pollenEntries[i];
      const rowY = startY + i * rowSpacing;

      // Label
      ctx.fillStyle = BLACK;
      ctx.font = "bold 22px Inter";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(entry.name, labelX, rowY + barH / 2);

      // Bar track
      roundedRectPath(ctx, barX, rowY, barMaxW, barH, barH / 2);
      ctx.fillStyle = BLACK;
      ctx.fill();

      // Bar fill
      const frac = Math.min(entry.value / maxPollenVal, 1);
      const fillBarW = Math.max(barH, frac * barMaxW);
      const level = pollenLevelLabel(entry.value);
      const barColor =
        level === "High" || level === "Very High" ? RED : YELLOW;

      roundedRectPath(ctx, barX, rowY, fillBarW, barH, barH / 2);
      ctx.fillStyle = barColor;
      ctx.fill();

      // Level label right-aligned
      ctx.fillStyle = BLACK;
      ctx.font = "20px Inter";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(level, barX + barMaxW + 20, rowY + barH / 2);
    }
  }

  return canvasToFramebuffer(canvas, palette);
}

function pollenLevelLabel(value: number): string {
  if (value === 0) return "None";
  if (value <= 10) return "Low";
  if (value <= 50) return "Moderate";
  if (value <= 100) return "High";
  return "Very High";
}
