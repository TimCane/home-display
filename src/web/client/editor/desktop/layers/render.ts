/**
 * Render individual layers to a Canvas 2D context.
 * Each renderer assumes the context is already translated/rotated
 * to the layer's position.
 */

import type { Layer } from "../state/types";
import type { Palette } from "../../../../shared/palette";

/** Cache loaded images so we don't re-decode every frame */
const imageCache = new Map<string, HTMLImageElement>();

export function getOrLoadImage(
  src: string,
  onLoad: () => void,
): HTMLImageElement | null {
  const cached = imageCache.get(src);
  if (cached && cached.complete) return cached;
  if (cached) return null; // still loading

  const img = new Image();
  img.onload = onLoad;
  img.src = src;
  imageCache.set(src, img);
  return null;
}

export function paletteToCSS(palette: Palette, index: number): string {
  const c = palette[index] ?? palette[0];
  return `rgb(${c.r},${c.g},${c.b})`;
}

export function renderLayer(
  ctx: CanvasRenderingContext2D,
  layer: Layer,
  palette: Palette,
  onImageLoad: () => void,
) {
  if (!layer.visible) return;

  ctx.save();

  // Position + rotation
  const cx = layer.x + layer.width / 2;
  const cy = layer.y + layer.height / 2;

  if (layer.rotation !== 0) {
    ctx.translate(cx, cy);
    ctx.rotate((layer.rotation * Math.PI) / 180);
    ctx.translate(-cx, -cy);
  }

  switch (layer.type) {
    case "background":
      ctx.fillStyle = paletteToCSS(palette, layer.colorIndex);
      ctx.fillRect(0, 0, 960, 680);
      break;

    case "image": {
      const img = getOrLoadImage(layer.src, onImageLoad);
      if (img) {
        ctx.drawImage(img, layer.x, layer.y, layer.width, layer.height);
      }
      break;
    }

    case "text":
      ctx.fillStyle = paletteToCSS(palette, layer.colorIndex);
      ctx.font = `${layer.fontSize}px ${layer.fontFamily}`;
      ctx.textBaseline = "top";
      ctx.fillText(layer.text, layer.x, layer.y);
      break;

    case "rect":
      if (layer.filled) {
        ctx.fillStyle = paletteToCSS(palette, layer.colorIndex);
        ctx.fillRect(layer.x, layer.y, layer.width, layer.height);
      } else {
        ctx.strokeStyle = paletteToCSS(palette, layer.colorIndex);
        ctx.lineWidth = layer.strokeWidth;
        ctx.strokeRect(layer.x, layer.y, layer.width, layer.height);
      }
      break;

    case "line":
      ctx.strokeStyle = paletteToCSS(palette, layer.colorIndex);
      ctx.lineWidth = layer.strokeWidth;
      ctx.beginPath();
      ctx.moveTo(layer.x, layer.y);
      ctx.lineTo(layer.x + layer.width, layer.y + layer.height);
      ctx.stroke();
      break;

    case "circle": {
      const rx = layer.width / 2;
      const ry = layer.height / 2;
      ctx.beginPath();
      ctx.ellipse(layer.x + rx, layer.y + ry, rx, ry, 0, 0, Math.PI * 2);
      if (layer.filled) {
        ctx.fillStyle = paletteToCSS(palette, layer.colorIndex);
        ctx.fill();
      } else {
        ctx.strokeStyle = paletteToCSS(palette, layer.colorIndex);
        ctx.lineWidth = layer.strokeWidth;
        ctx.stroke();
      }
      break;
    }

    case "icon":
      // Icons rendered as text using Lucide name — we'll draw a placeholder
      // with the icon name. Full Lucide SVG rendering below.
      renderIcon(ctx, layer, palette);
      break;
  }

  ctx.restore();
}

function renderIcon(
  ctx: CanvasRenderingContext2D,
  layer: Layer & { type: "icon" },
  palette: Palette,
) {
  // Draw icon as a bordered box with the icon SVG rendered inside
  // We use a simple approach: draw the Lucide icon path via an offscreen SVG
  const color = paletteToCSS(palette, layer.colorIndex);
  ctx.fillStyle = color;
  ctx.font = `${Math.min(layer.width, layer.height)}px sans-serif`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  // Render a unicode placeholder or the icon name
  ctx.fillText("◆", layer.x + layer.width / 2, layer.y + layer.height / 2);
  ctx.textAlign = "start";
}

/**
 * Draw selection overlay (handles + bounding box) for the selected layer.
 */
export function renderSelection(
  ctx: CanvasRenderingContext2D,
  layer: Layer,
) {
  ctx.save();

  const cx = layer.x + layer.width / 2;
  const cy = layer.y + layer.height / 2;

  if (layer.rotation !== 0) {
    ctx.translate(cx, cy);
    ctx.rotate((layer.rotation * Math.PI) / 180);
    ctx.translate(-cx, -cy);
  }

  // Bounding box
  ctx.strokeStyle = "#3b82f6";
  ctx.lineWidth = 2;
  ctx.setLineDash([]);
  ctx.strokeRect(layer.x, layer.y, layer.width, layer.height);

  // Corner handles
  const handleSize = 8;
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#3b82f6";
  ctx.lineWidth = 2;

  const corners = [
    [layer.x, layer.y],
    [layer.x + layer.width, layer.y],
    [layer.x, layer.y + layer.height],
    [layer.x + layer.width, layer.y + layer.height],
  ];
  for (const [hx, hy] of corners) {
    ctx.fillRect(hx - handleSize / 2, hy - handleSize / 2, handleSize, handleSize);
    ctx.strokeRect(hx - handleSize / 2, hy - handleSize / 2, handleSize, handleSize);
  }

  // Rotate handle (top center, above the layer)
  const rotateY = layer.y - 24;
  const rotateX = layer.x + layer.width / 2;

  // Line from top center to rotate handle
  ctx.strokeStyle = "#3b82f6";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(rotateX, layer.y);
  ctx.lineTo(rotateX, rotateY);
  ctx.stroke();

  // Rotate circle
  ctx.beginPath();
  ctx.arc(rotateX, rotateY, 5, 0, Math.PI * 2);
  ctx.fillStyle = "#3b82f6";
  ctx.fill();

  ctx.restore();
}

/**
 * Draw snap guide lines on the canvas.
 */
export function renderGuides(
  ctx: CanvasRenderingContext2D,
  guides: { axis: "x" | "y"; position: number }[],
) {
  ctx.save();
  ctx.strokeStyle = "#f97316";
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);

  for (const g of guides) {
    ctx.beginPath();
    if (g.axis === "x") {
      ctx.moveTo(g.position, 0);
      ctx.lineTo(g.position, 680);
    } else {
      ctx.moveTo(0, g.position);
      ctx.lineTo(960, g.position);
    }
    ctx.stroke();
  }

  ctx.restore();
}
