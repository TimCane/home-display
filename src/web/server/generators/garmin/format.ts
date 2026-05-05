/**
 * Shared formatting and icon helpers for Garmin renderers.
 */

import type { SKRSContext2D } from "@napi-rs/canvas";
import { DISPLAY_FONT, BLACK, WHITE, YELLOW } from "../render-utils.js";

/* ── Text formatting ───────────────────────────────────────────── */

export function formatDistance(metres: number): string {
  if (metres >= 1000) return `${(metres / 1000).toFixed(1)} km`;
  return `${Math.round(metres)} m`;
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.round(seconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function formatDurationShort(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function formatDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function formatSteps(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export function formatPace(speedMs: number): string {
  if (speedMs <= 0) return "--:--";
  const paceSecsPerKm = 1000 / speedMs;
  const mins = Math.floor(paceSecsPerKm / 60);
  const secs = Math.round(paceSecsPerKm % 60);
  return `${mins}:${String(secs).padStart(2, "0")} /km`;
}

export function formatSpeed(speedMs: number): string {
  return `${(speedMs * 3.6).toFixed(1)} km/h`;
}

export function formatWeight(grams: number): string {
  return `${(grams / 1000).toFixed(1)}`;
}

export function activityLabel(type: string): string {
  const t = type.toLowerCase();
  if (t.includes("run")) return "RUN";
  if (t.includes("cycling") || t.includes("biking")) return "RIDE";
  if (t.includes("swim")) return "SWIM";
  if (t.includes("walk")) return "WALK";
  if (t.includes("hik")) return "HIKE";
  if (t.includes("strength") || t.includes("weight")) return "GYM";
  if (t.includes("yoga")) return "YOGA";
  if (t.includes("cardio")) return "CARDIO";
  return type.slice(0, 5).toUpperCase();
}

export function isRunOrWalk(type: string): boolean {
  const t = type.toLowerCase();
  return t.includes("run") || t.includes("walk") || t.includes("hik");
}

export function dayLabel(date: Date): string {
  return date.toLocaleDateString("en-GB", { weekday: "short" });
}

/* ── Icon helpers ──────────────────────────────────────────────── */

export { DISPLAY_FONT, BLACK, WHITE, YELLOW };

export function drawStepsIcon(ctx: SKRSContext2D, cx: number, cy: number): void {
  ctx.fillStyle = YELLOW;
  ctx.beginPath();
  ctx.ellipse(cx - 8, cy, 10, 14, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx + 8, cy - 2, 9, 12, 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = BLACK;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(cx - 8, cy, 10, 14, -0.3, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(cx + 8, cy - 2, 9, 12, 0.3, 0, Math.PI * 2);
  ctx.stroke();
}

export function drawHeartIcon(ctx: SKRSContext2D, cx: number, cy: number): void {
  ctx.fillStyle = YELLOW;
  ctx.beginPath();
  ctx.moveTo(cx, cy + 12);
  ctx.bezierCurveTo(cx - 20, cy - 2, cx - 20, cy - 16, cx, cy - 8);
  ctx.bezierCurveTo(cx + 20, cy - 16, cx + 20, cy - 2, cx, cy + 12);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = BLACK;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

export function drawSleepIcon(ctx: SKRSContext2D, cx: number, cy: number): void {
  ctx.fillStyle = YELLOW;
  ctx.beginPath();
  ctx.arc(cx, cy, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = WHITE;
  ctx.beginPath();
  ctx.arc(cx + 7, cy - 5, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = BLACK;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, 14, 0, Math.PI * 2);
  ctx.stroke();
}

export function drawScaleIcon(ctx: SKRSContext2D, cx: number, cy: number): void {
  // Simple scale/weight icon
  ctx.strokeStyle = BLACK;
  ctx.lineWidth = 2;
  // Platform
  ctx.fillStyle = YELLOW;
  ctx.beginPath();
  ctx.ellipse(cx, cy + 6, 16, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Dial
  ctx.beginPath();
  ctx.arc(cx, cy - 4, 8, 0, Math.PI * 2);
  ctx.fillStyle = WHITE;
  ctx.fill();
  ctx.stroke();
  // Needle
  ctx.beginPath();
  ctx.moveTo(cx, cy - 4);
  ctx.lineTo(cx + 5, cy - 8);
  ctx.stroke();
}

export function drawDropIcon(ctx: SKRSContext2D, cx: number, cy: number): void {
  // Water droplet
  ctx.fillStyle = YELLOW;
  ctx.beginPath();
  ctx.moveTo(cx, cy - 14);
  ctx.quadraticCurveTo(cx - 12, cy + 2, cx, cy + 14);
  ctx.quadraticCurveTo(cx + 12, cy + 2, cx, cy - 14);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = BLACK;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}
