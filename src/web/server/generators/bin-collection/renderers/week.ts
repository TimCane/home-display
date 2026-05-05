/**
 * Bin collection "week" renderer.
 * Shows this week's collection schedule grouped by date.
 */

import type { BinCollectionData, BinCollection } from "../fetch.js";
import {
  createFrame,
  loadPalette,
  loadTimezone,
  canvasToFramebuffer,
  drawHeaderBar,
  BLACK,
  WHITE,
  YELLOW,
  RED,
} from "../../render-utils.js";
import { WIDTH, HEIGHT } from "../../../../shared/framebuffer.js";

interface BinCollectionConfig {
  council_name: string;
}

/** Return a colour for the bin-type dot. */
function binDotColor(binType: string): string {
  switch (binType) {
    case "recycling":
      return YELLOW;
    case "general":
    case "food":
      return RED;
    default:
      return BLACK; // garden, other
  }
}

/** Filter collections to the current week (Mon-Sun). */
function collectionsThisWeek(
  collections: BinCollection[],
  tz: string,
): BinCollection[] {
  const now = new Date();
  const todayStr = now.toLocaleDateString("sv-SE", { timeZone: tz });
  const today = new Date(todayStr + "T12:00:00");

  // Find start of this week (Monday)
  const dayOfWeek = today.getDay(); // 0=Sun
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(today.getTime() + mondayOffset * 86400000);
  const sunday = new Date(monday.getTime() + 6 * 86400000);

  const monStr = monday.toISOString().slice(0, 10);
  const sunStr = sunday.toISOString().slice(0, 10);

  return collections.filter((c) => c.date >= monStr && c.date <= sunStr);
}

/** Group collections by date. */
function groupByDate(
  collections: BinCollection[],
): Map<string, BinCollection[]> {
  const groups = new Map<string, BinCollection[]>();
  for (const c of collections) {
    const existing = groups.get(c.date);
    if (existing) {
      existing.push(c);
    } else {
      groups.set(c.date, [c]);
    }
  }
  return groups;
}

export async function renderWeek(
  data: BinCollectionData,
  _config: BinCollectionConfig,
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
  ctx.font = "bold 26px Inter";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("THIS WEEK'S COLLECTIONS", 40, 35);
  ctx.font = "22px Inter";
  ctx.textAlign = "right";
  ctx.fillText(data.councilName, WIDTH - 40, 35);

  // Yellow accent stripe
  ctx.fillStyle = YELLOW;
  ctx.fillRect(0, 70, WIDTH, 3);

  // ── Filter to this week ──
  const weekCollections = collectionsThisWeek(data.collections, tz);

  if (weekCollections.length === 0) {
    ctx.fillStyle = BLACK;
    ctx.font = "36px Inter";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("No collections this week", WIDTH / 2, HEIGHT / 2);
    return canvasToFramebuffer(canvas, palette);
  }

  const grouped = groupByDate(weekCollections);
  const sortedDates = [...grouped.keys()].sort();

  const topY = 100;
  const bottomY = 640;
  const availableH = bottomY - topY;
  const rowSpacing = Math.min(
    availableH / sortedDates.length,
    140,
  );

  for (let i = 0; i < sortedDates.length; i++) {
    const dateKey = sortedDates[i];
    const items = grouped.get(dateKey)!;
    const rowY = topY + i * rowSpacing;

    // ── Date label ──
    const d = new Date(dateKey + "T12:00:00");
    const dateLabel = d.toLocaleDateString("en-GB", {
      timeZone: tz,
      weekday: "short",
      day: "numeric",
      month: "short",
    });

    ctx.fillStyle = BLACK;
    ctx.font = "bold 24px Inter";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(dateLabel, 90, rowY);

    // ── Colored dot for first bin type ──
    // Draw one dot per collection type, stacked if multiple
    const dotX = 60;
    const dotBaseY = rowY + 14;

    // Draw the primary dot (first collection's type)
    ctx.beginPath();
    ctx.arc(dotX, dotBaseY, 12, 0, Math.PI * 2);
    ctx.fillStyle = binDotColor(items[0].binType);
    ctx.fill();

    // If multiple types, draw a smaller secondary dot offset
    if (items.length > 1) {
      ctx.beginPath();
      ctx.arc(dotX + 18, dotBaseY, 8, 0, Math.PI * 2);
      ctx.fillStyle = binDotColor(items[1].binType);
      ctx.fill();
    }

    // ── Dashed separator ──
    ctx.strokeStyle = BLACK;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(90, rowY + 34);
    ctx.lineTo(WIDTH - 40, rowY + 34);
    ctx.stroke();
    ctx.setLineDash([]);

    // ── Collection labels ──
    ctx.fillStyle = BLACK;
    ctx.font = "22px Inter";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";

    for (let j = 0; j < items.length; j++) {
      const item = items[j];
      const labelY = rowY + 42 + j * 28;
      const displayLabel =
        item.label !== item.binType
          ? `${capitalize(item.binType)} (${item.label})`
          : capitalize(item.binType);
      ctx.fillText(displayLabel, 90, labelY);
    }
  }

  return canvasToFramebuffer(canvas, palette);
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
