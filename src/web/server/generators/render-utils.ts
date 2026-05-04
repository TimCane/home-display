/**
 * Shared utilities for server-side canvas rendering in generator plugins.
 */

import { createCanvas, type Canvas, type SKRSContext2D } from "@napi-rs/canvas";
import { WIDTH, HEIGHT } from "../../shared/framebuffer.js";
import { dither } from "../../shared/dither.js";
import { type Palette } from "../../shared/palette.js";
import { getSetting } from "../config/settings.js";

export { DISPLAY_FONT } from "../fonts/index.js";

/* ── Palette colour constants ────────────────────────────────────── */

export const BLACK = "#000000";
export const WHITE = "#FFFFFF";
export const YELLOW = "#FFE600";
export const RED = "#CC0000";

/* ── Canvas / framebuffer helpers ────────────────────────────────── */

/** Create a 960x680 canvas. */
export function createFrame(): Canvas {
  return createCanvas(WIDTH, HEIGHT);
}

/** Read the current palette from app_settings and convert hex to Palette. */
export async function loadPalette(): Promise<Palette> {
  const raw = await getSetting("palette");
  const parse = (hex: string) => ({
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  });
  return [parse(raw.black), parse(raw.white), parse(raw.yellow), parse(raw.red)];
}

/** Read app_tz from settings. */
export async function loadTimezone(): Promise<string> {
  return getSetting("app_tz");
}

/** Convert canvas to dithered 2bpp framebuffer (163,200 bytes). */
export function canvasToFramebuffer(
  canvas: Canvas,
  palette: Palette,
): Uint8Array {
  const ctx = canvas.getContext("2d");
  const imageData = ctx.getImageData(0, 0, WIDTH, HEIGHT);
  return dither(new Uint8Array(imageData.data), WIDTH, HEIGHT, palette);
}

/* ── Drawing helpers ─────────────────────────────────────────────── */

/** Trace a rounded-rect path (does not fill/stroke — caller decides). */
export function roundedRectPath(
  ctx: SKRSContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

/** Draw a full-width coloured header bar. */
export function drawHeaderBar(
  ctx: SKRSContext2D,
  y: number,
  height: number,
  color: string,
): void {
  ctx.fillStyle = color;
  ctx.fillRect(0, y, WIDTH, height);
}

/** Truncate text with ellipsis to fit within maxWidth. */
export function truncateText(
  ctx: SKRSContext2D,
  text: string,
  maxWidth: number,
): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let s = text;
  while (s.length > 3 && ctx.measureText(s + "...").width > maxWidth) {
    s = s.slice(0, -1);
  }
  return s + "...";
}

/** Draw a filled area chart with stroke line and dot markers. */
export function drawFilledAreaChart(
  ctx: SKRSContext2D,
  points: { x: number; y: number }[],
  baselineY: number,
  opts: {
    fillColor: string;
    strokeColor: string;
    dotColor: string;
    lineWidth: number;
    dotRadius: number;
    dotEvery: number;
  },
): void {
  if (points.length < 2) return;

  // Filled area
  ctx.beginPath();
  ctx.moveTo(points[0].x, baselineY);
  for (const p of points) ctx.lineTo(p.x, p.y);
  ctx.lineTo(points[points.length - 1].x, baselineY);
  ctx.closePath();
  ctx.fillStyle = opts.fillColor;
  ctx.fill();

  // Stroke line on top
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.strokeStyle = opts.strokeColor;
  ctx.lineWidth = opts.lineWidth;
  ctx.stroke();

  // Dot markers
  for (let i = 0; i < points.length; i += opts.dotEvery) {
    ctx.beginPath();
    ctx.arc(points[i].x, points[i].y, opts.dotRadius, 0, Math.PI * 2);
    ctx.fillStyle = opts.dotColor;
    ctx.fill();
  }
}

/* ── Weather icons (filled silhouettes) ──────────────────────────── */

export function drawWeatherIcon(
  ctx: SKRSContext2D,
  icon: string,
  x: number,
  y: number,
  size: number,
  color: string,
): void {
  ctx.save();
  const cx = x + size / 2;
  const cy = y + size / 2;
  const r = size * 0.35;

  switch (icon) {
    case "sun":
      drawSun(ctx, cx, cy, r, size, color);
      break;
    case "cloud":
      drawCloudFilled(ctx, cx, cy, r, color);
      break;
    case "rain":
      drawCloudFilled(ctx, cx, cy - size * 0.12, r * 0.82, color);
      drawRainDrops(ctx, cx, cy + r * 0.25, r, size, color);
      break;
    case "snow":
      drawCloudFilled(ctx, cx, cy - size * 0.12, r * 0.82, color);
      drawSnowflakes(ctx, cx, cy + r * 0.35, r, size, color);
      break;
    case "thunder":
      drawCloudFilled(ctx, cx, cy - size * 0.15, r * 0.82, color);
      drawLightningBolt(ctx, cx, cy + r * 0.05, size);
      break;
    case "fog":
      drawFog(ctx, cx, cy, r, size, color);
      break;
    default:
      ctx.font = `bold ${size * 0.45}px Inter`;
      ctx.fillStyle = color;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("?", cx, cy);
      break;
  }

  ctx.restore();
}

function drawSun(
  ctx: SKRSContext2D, cx: number, cy: number,
  r: number, size: number, color: string,
): void {
  ctx.fillStyle = color;
  // Centre disc
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.6, 0, Math.PI * 2);
  ctx.fill();
  // 8 triangular rays
  const innerR = r * 0.72;
  const outerR = r + size * 0.12;
  const halfAngle = Math.PI / 28; // narrow triangles
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI) / 4;
    ctx.beginPath();
    ctx.moveTo(
      cx + Math.cos(angle - halfAngle) * innerR,
      cy + Math.sin(angle - halfAngle) * innerR,
    );
    ctx.lineTo(
      cx + Math.cos(angle) * outerR,
      cy + Math.sin(angle) * outerR,
    );
    ctx.lineTo(
      cx + Math.cos(angle + halfAngle) * innerR,
      cy + Math.sin(angle + halfAngle) * innerR,
    );
    ctx.closePath();
    ctx.fill();
  }
}

function drawCloudFilled(
  ctx: SKRSContext2D, cx: number, cy: number,
  r: number, color: string,
): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  // Three overlapping circles merged into one path
  ctx.arc(cx - r * 0.38, cy + r * 0.05, r * 0.42, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + r * 0.32, cy + r * 0.08, r * 0.38, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + r * 0.02, cy - r * 0.2, r * 0.48, 0, Math.PI * 2);
  ctx.fill();
  // Flat bottom rectangle to fill gaps and create flat base
  ctx.fillRect(cx - r * 0.75, cy + r * 0.1, r * 1.5, r * 0.35);
}

function drawRainDrops(
  ctx: SKRSContext2D, cx: number, baseY: number,
  r: number, size: number, color: string,
): void {
  ctx.fillStyle = color;
  const dropH = size * 0.12;
  const dropW = size * 0.04;
  for (let i = 0; i < 4; i++) {
    const dx = cx - r * 0.5 + i * r * 0.35;
    const dy = baseY + (i % 2) * size * 0.06;
    // Teardrop: pointed top, round bottom
    ctx.beginPath();
    ctx.moveTo(dx, dy);
    ctx.quadraticCurveTo(dx - dropW, dy + dropH * 0.7, dx, dy + dropH);
    ctx.quadraticCurveTo(dx + dropW, dy + dropH * 0.7, dx, dy);
    ctx.closePath();
    ctx.fill();
  }
}

function drawSnowflakes(
  ctx: SKRSContext2D, cx: number, baseY: number,
  r: number, size: number, color: string,
): void {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  const flakeR = size * 0.05;
  ctx.lineWidth = Math.max(1.5, size / 40);
  for (let i = 0; i < 3; i++) {
    const fx = cx - r * 0.45 + i * r * 0.45;
    const fy = baseY + (i % 2) * size * 0.05;
    // 3 crossed lines = 6-pointed asterisk
    for (let a = 0; a < 3; a++) {
      const angle = (a * Math.PI) / 3;
      ctx.beginPath();
      ctx.moveTo(fx + Math.cos(angle) * flakeR, fy + Math.sin(angle) * flakeR);
      ctx.lineTo(fx - Math.cos(angle) * flakeR, fy - Math.sin(angle) * flakeR);
      ctx.stroke();
    }
    // Centre dot
    ctx.beginPath();
    ctx.arc(fx, fy, size * 0.015, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawLightningBolt(
  ctx: SKRSContext2D, cx: number, topY: number, size: number,
): void {
  // Filled yellow lightning bolt polygon
  ctx.fillStyle = YELLOW;
  const s = size * 0.08;
  ctx.beginPath();
  ctx.moveTo(cx + s * 0.3, topY);
  ctx.lineTo(cx - s * 1.2, topY + s * 3.2);
  ctx.lineTo(cx - s * 0.1, topY + s * 2.8);
  ctx.lineTo(cx - s * 0.8, topY + s * 5.5);
  ctx.lineTo(cx + s * 0.8, topY + s * 2.5);
  ctx.lineTo(cx - s * 0.05, topY + s * 2.8);
  ctx.lineTo(cx + s * 0.3, topY);
  ctx.closePath();
  ctx.fill();
  // Black outline for definition
  ctx.strokeStyle = BLACK;
  ctx.lineWidth = Math.max(1, size / 60);
  ctx.stroke();
}

function drawFog(
  ctx: SKRSContext2D, cx: number, cy: number,
  r: number, _size: number, color: string,
): void {
  ctx.fillStyle = color;
  const barH = r * 0.22;
  const gap = r * 0.18;
  const widths = [r * 1.6, r * 1.2, r * 1.5, r * 1.0];
  for (let i = 0; i < widths.length; i++) {
    const bw = widths[i];
    const by = cy - r * 0.5 + i * (barH + gap);
    roundedRectPath(ctx, cx - bw / 2, by, bw, barH, barH / 2);
    ctx.fill();
  }
}
