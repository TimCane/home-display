/**
 * Shared utilities for server-side canvas rendering in generator plugins.
 */

import { createCanvas, type Canvas, type SKRSContext2D } from "@napi-rs/canvas";
import { WIDTH, HEIGHT } from "../../shared/framebuffer.js";
import { dither } from "../../shared/dither.js";
import { type Palette } from "../../shared/palette.js";
import { getSetting } from "../config/settings.js";

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
  return [parse(raw.black), parse(raw.white), parse(raw.red), parse(raw.yellow)];
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

/** Draw a simple weather icon on the canvas at the given position. */
export function drawWeatherIcon(
  ctx: SKRSContext2D,
  icon: string,
  x: number,
  y: number,
  size: number,
  color: string,
): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(2, size / 16);

  const cx = x + size / 2;
  const cy = y + size / 2;
  const r = size * 0.35;

  switch (icon) {
    case "sun":
      // Circle with rays
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
      for (let i = 0; i < 8; i++) {
        const angle = (i * Math.PI) / 4;
        const innerR = r + size * 0.08;
        const outerR = r + size * 0.2;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(angle) * innerR, cy + Math.sin(angle) * innerR);
        ctx.lineTo(cx + Math.cos(angle) * outerR, cy + Math.sin(angle) * outerR);
        ctx.stroke();
      }
      break;

    case "cloud":
      drawCloud(ctx, cx, cy, r);
      break;

    case "rain":
      drawCloud(ctx, cx, cy - size * 0.1, r * 0.85);
      // Rain drops
      for (let i = 0; i < 3; i++) {
        const dx = cx - r * 0.5 + i * r * 0.5;
        const dy = cy + r * 0.4;
        ctx.beginPath();
        ctx.moveTo(dx, dy);
        ctx.lineTo(dx - size * 0.04, dy + size * 0.15);
        ctx.stroke();
      }
      break;

    case "snow":
      drawCloud(ctx, cx, cy - size * 0.1, r * 0.85);
      // Snowflakes (dots)
      for (let i = 0; i < 3; i++) {
        const dx = cx - r * 0.5 + i * r * 0.5;
        const dy = cy + r * 0.5;
        ctx.beginPath();
        ctx.arc(dx, dy, size * 0.03, 0, Math.PI * 2);
        ctx.fill();
      }
      break;

    case "thunder":
      drawCloud(ctx, cx, cy - size * 0.15, r * 0.85);
      // Lightning bolt
      ctx.beginPath();
      ctx.moveTo(cx, cy + r * 0.1);
      ctx.lineTo(cx - size * 0.08, cy + r * 0.45);
      ctx.lineTo(cx + size * 0.02, cy + r * 0.4);
      ctx.lineTo(cx - size * 0.04, cy + r * 0.7);
      ctx.stroke();
      break;

    default:
      // Fallback: question mark
      ctx.font = `${size * 0.5}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("?", cx, cy);
      break;
  }

  ctx.restore();
}

function drawCloud(ctx: SKRSContext2D, cx: number, cy: number, r: number): void {
  // Simple cloud shape with overlapping arcs
  ctx.beginPath();
  ctx.arc(cx - r * 0.3, cy, r * 0.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx + r * 0.3, cy, r * 0.45, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy - r * 0.25, r * 0.5, 0, Math.PI * 2);
  ctx.stroke();
}
