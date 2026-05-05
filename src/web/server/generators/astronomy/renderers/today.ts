/**
 * Astronomy "today" renderer.
 * Layout: header bar, sun arc section, moon card (left), golden hour card (right).
 */

import type { AstronomyData } from "../fetch.js";
import {
  createFrame,
  loadPalette,
  canvasToFramebuffer,
  drawHeaderBar,
  roundedRectPath,
  truncateText,
  BLACK, WHITE, YELLOW, RED,
} from "../../render-utils.js";
import type { SKRSContext2D } from "@napi-rs/canvas";
import { WIDTH, HEIGHT } from "../../../../shared/framebuffer.js";

interface AstronomyConfig {
  location: { name: string };
}

export async function renderToday(
  data: AstronomyData,
  config: AstronomyConfig,
): Promise<Uint8Array> {
  const palette = await loadPalette();
  const canvas = createFrame();
  const ctx = canvas.getContext("2d");

  // ── Background ──
  ctx.fillStyle = WHITE;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // ── Header bar (0-70) ──
  drawHeaderBar(ctx, 0, 70, BLACK);

  // Yellow accent stripe
  ctx.fillStyle = YELLOW;
  ctx.fillRect(0, 70, WIDTH, 3);

  ctx.fillStyle = WHITE;
  ctx.font = "bold 32px Inter";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("ASTRONOMY", 40, 36);

  ctx.font = "24px Inter";
  ctx.textAlign = "right";
  ctx.fillText(truncateText(ctx, config.location.name, 400), WIDTH - 40, 36);

  // ── Sun arc section (y=90 to y=320) ──
  const arcLeft = 150;
  const arcRight = 810;
  const arcBase = 280;
  const arcPeak = 110;
  const arcCx = (arcLeft + arcRight) / 2;
  const arcRx = (arcRight - arcLeft) / 2;
  const arcRy = arcBase - arcPeak;

  // Horizon line
  ctx.strokeStyle = BLACK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(arcLeft - 20, arcBase);
  ctx.lineTo(arcRight + 20, arcBase);
  ctx.stroke();

  // Semi-elliptical arc (yellow fill with black outline)
  ctx.beginPath();
  ctx.ellipse(arcCx, arcBase, arcRx, arcRy, 0, Math.PI, 0);
  ctx.fillStyle = YELLOW;
  ctx.globalAlpha = 0.15;
  ctx.fill();
  ctx.globalAlpha = 1.0;

  ctx.beginPath();
  ctx.ellipse(arcCx, arcBase, arcRx, arcRy, 0, Math.PI, 0);
  ctx.strokeStyle = BLACK;
  ctx.lineWidth = 3;
  ctx.stroke();

  // Yellow arc on top
  ctx.beginPath();
  ctx.ellipse(arcCx, arcBase, arcRx, arcRy, 0, Math.PI, 0);
  ctx.strokeStyle = YELLOW;
  ctx.lineWidth = 3;
  ctx.stroke();

  // Black outline over the yellow
  ctx.beginPath();
  ctx.ellipse(arcCx, arcBase, arcRx, arcRy, 0, Math.PI, 0);
  ctx.strokeStyle = BLACK;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Sun symbol at the top of the arc
  ctx.beginPath();
  ctx.arc(arcCx, arcPeak, 12, 0, Math.PI * 2);
  ctx.fillStyle = YELLOW;
  ctx.fill();
  ctx.strokeStyle = BLACK;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Sunrise time (below left end)
  ctx.fillStyle = BLACK;
  ctx.font = "bold 24px Inter";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText(data.sunrise, arcLeft, arcBase + 10);

  // Sunset time (below right end)
  ctx.fillText(data.sunset, arcRight, arcBase + 10);

  // Daylight duration centered below horizon
  const hours = Math.floor(data.daylightMinutes / 60);
  const mins = data.daylightMinutes % 60;
  const daylightStr = `${hours}h ${mins}m daylight`;

  ctx.font = "bold 24px Inter";
  ctx.textAlign = "center";
  ctx.fillText(daylightStr, arcCx, arcBase + 45);

  // Daylight change
  const changeSign = data.daylightChange >= 0 ? "+" : "";
  const changeStr = `(${changeSign}${data.daylightChange}m)`;
  const daylightW = ctx.measureText(daylightStr).width;
  ctx.font = "20px Inter";
  ctx.fillStyle = data.daylightChange >= 0 ? YELLOW : RED;
  ctx.textAlign = "left";
  ctx.fillText(changeStr, arcCx + daylightW / 2 + 8, arcBase + 48);

  // ── Bottom section: two side-by-side cards (y=360 to y=660) ──

  // ── Moon card (left, x=40 to x=460) ──
  const moonCardX = 40;
  const moonCardY = 360;
  const moonCardW = 420;
  const moonCardH = 300;

  roundedRectPath(ctx, moonCardX, moonCardY, moonCardW, moonCardH, 12);
  ctx.fillStyle = WHITE;
  ctx.fill();
  ctx.strokeStyle = BLACK;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Draw moon
  const moonCx = moonCardX + moonCardW / 2;
  const moonCy = moonCardY + 110;
  const moonR = 60;

  // Full white circle
  ctx.beginPath();
  ctx.arc(moonCx, moonCy, moonR, 0, Math.PI * 2);
  ctx.fillStyle = WHITE;
  ctx.fill();
  ctx.strokeStyle = BLACK;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Shadow overlay for crescent effect
  const illum = data.moonPhase.illumination;
  const isWaxing = data.moonPhase.dayOfCycle < SYNODIC_PERIOD / 2;

  if (illum < 0.99) {
    ctx.save();
    // Clip to the moon circle
    ctx.beginPath();
    ctx.arc(moonCx, moonCy, moonR, 0, Math.PI * 2);
    ctx.clip();

    // The terminator offset: maps illumination to how much of the disc is lit.
    // offset = cos(pi * illumination) * moonR creates the crescent shape.
    // At illum=0 (new moon) offset = moonR (full shadow).
    // At illum=0.5 (quarter) offset = 0 (half shadow).
    // At illum=1 (full) offset = -moonR (no shadow).
    const offset = Math.cos(Math.PI * illum) * moonR;

    ctx.beginPath();
    if (isWaxing) {
      // Shadow on the left side
      // Left arc (full semicircle, left half of moon)
      ctx.arc(moonCx, moonCy, moonR, Math.PI / 2, -Math.PI / 2, false);
      // Terminator arc (elliptical)
      ctx.ellipse(moonCx, moonCy, Math.abs(offset), moonR, 0, -Math.PI / 2, Math.PI / 2, offset > 0);
    } else {
      // Shadow on the right side
      ctx.arc(moonCx, moonCy, moonR, -Math.PI / 2, Math.PI / 2, false);
      ctx.ellipse(moonCx, moonCy, Math.abs(offset), moonR, 0, Math.PI / 2, -Math.PI / 2, offset > 0);
    }
    ctx.closePath();
    ctx.fillStyle = BLACK;
    ctx.fill();
    ctx.restore();
  }

  // Phase name below moon
  ctx.fillStyle = BLACK;
  ctx.font = "bold 22px Inter";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText(data.moonPhase.name, moonCx, moonCy + moonR + 16);

  // Illumination percentage
  const illumPct = `${Math.round(illum * 100)}% illuminated`;
  ctx.font = "18px Inter";
  ctx.fillText(illumPct, moonCx, moonCy + moonR + 46);

  // ── Golden hour + info card (right, x=500 to x=920) ──
  const goldCardX = 500;
  const goldCardY = 360;
  const goldCardW = 420;
  const goldCardH = 300;

  roundedRectPath(ctx, goldCardX, goldCardY, goldCardW, goldCardH, 12);
  ctx.fillStyle = WHITE;
  ctx.fill();
  ctx.strokeStyle = BLACK;
  ctx.lineWidth = 2;
  ctx.stroke();

  // "GOLDEN HOUR" label
  ctx.fillStyle = YELLOW;
  ctx.font = "bold 20px Inter";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText("GOLDEN HOUR", goldCardX + 30, goldCardY + 25);

  // Time range
  const goldenTimeStr = `${data.goldenHourStart} \u2013 ${data.goldenHourEnd}`;
  ctx.fillStyle = BLACK;
  ctx.font = "bold 28px Inter";
  ctx.fillText(goldenTimeStr, goldCardX + 30, goldCardY + 60);

  // Yellow rectangle decoration
  ctx.fillStyle = YELLOW;
  ctx.fillRect(goldCardX + 30, goldCardY + 100, 80, 4);

  // Quick-reference list: sunrise / sunset
  const listStartY = goldCardY + 130;

  // Sunrise icon (small yellow circle with rays)
  drawSmallSunIcon(ctx, goldCardX + 45, listStartY + 12, 10);
  ctx.fillStyle = BLACK;
  ctx.font = "20px Inter";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(`Sunrise  ${data.sunrise}`, goldCardX + 65, listStartY + 12);

  // Sunset icon
  drawSmallSunIcon(ctx, goldCardX + 45, listStartY + 50, 10);
  ctx.fillStyle = BLACK;
  ctx.fillText(`Sunset   ${data.sunset}`, goldCardX + 65, listStartY + 50);

  // Daylight summary
  ctx.fillStyle = BLACK;
  ctx.font = "18px Inter";
  ctx.fillText(`${hours}h ${mins}m total daylight`, goldCardX + 30, listStartY + 95);

  // Moon phase summary
  ctx.fillText(
    `Moon: ${data.moonPhase.name}`,
    goldCardX + 30,
    listStartY + 125,
  );

  return canvasToFramebuffer(canvas, palette);
}

/* ── Helpers ────────────────────────────────────────────────────── */

const SYNODIC_PERIOD = 29.53058770576;

function drawSmallSunIcon(
  ctx: SKRSContext2D,
  cx: number,
  cy: number,
  r: number,
): void {
  ctx.fillStyle = YELLOW;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = BLACK;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Small rays
  ctx.strokeStyle = YELLOW;
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI) / 4;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * (r + 2), cy + Math.sin(angle) * (r + 2));
    ctx.lineTo(cx + Math.cos(angle) * (r + 6), cy + Math.sin(angle) * (r + 6));
    ctx.stroke();
  }
}
