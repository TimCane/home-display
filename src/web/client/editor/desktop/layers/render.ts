/**
 * Render individual layers to a Canvas 2D context.
 * Each renderer assumes the context is already translated/rotated
 * to the layer's position.
 */

import type { Layer } from "../state/types";
import type { Palette } from "../../../../shared/palette";
import { loadIconNode, getIconNodeSync } from "../lucide-icon-data";

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
      renderAutoFitText(ctx, layer);
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
      renderIcon(ctx, layer, palette, onImageLoad);
      break;
  }

  ctx.restore();
}

/**
 * Word-wrap text to fit within a given width at the specified font size.
 * Returns an array of lines.
 */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/);
  if (words.length === 0) return [""];

  const lines: string[] = [];
  let currentLine = words[0];

  for (let i = 1; i < words.length; i++) {
    const testLine = currentLine + " " + words[i];
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth) {
      lines.push(currentLine);
      currentLine = words[i];
    } else {
      currentLine = testLine;
    }
  }
  lines.push(currentLine);
  return lines;
}

/**
 * Render text auto-fitted within the layer's bounding box.
 * Uses binary search to find the largest font size where the
 * word-wrapped text fits within layer.width x layer.height.
 */
function renderAutoFitText(
  ctx: CanvasRenderingContext2D,
  layer: Layer & { type: "text" },
): void {
  const { x, y, width, height, text, fontFamily } = layer;
  if (!text.trim() || width <= 0 || height <= 0) return;

  // Binary search for the largest font size that fits
  let lo = 1;
  let hi = Math.max(height, 200); // upper bound
  let bestSize = lo;

  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    ctx.font = `${mid}px ${fontFamily}`;
    const lines = wrapText(ctx, text, width);
    const lineHeight = mid * 1.2;
    const totalHeight = lines.length * lineHeight;

    // Check that all lines fit width and total height fits
    let fitsWidth = true;
    for (const line of lines) {
      if (ctx.measureText(line).width > width) {
        fitsWidth = false;
        break;
      }
    }

    if (fitsWidth && totalHeight <= height) {
      bestSize = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  // Draw with the best size found
  const fontSize = bestSize;
  ctx.font = `${fontSize}px ${fontFamily}`;
  ctx.textBaseline = "top";
  const lines = wrapText(ctx, text, width);
  const lineHeight = fontSize * 1.2;
  const totalHeight = lines.length * lineHeight;

  // Vertically center the text block within the bounding box
  const startY = y + (height - totalHeight) / 2;

  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], x, startY + i * lineHeight);
  }
}

function renderIcon(
  ctx: CanvasRenderingContext2D,
  layer: Layer & { type: "icon" },
  palette: Palette,
  onImageLoad: () => void,
) {
  const color = paletteToCSS(palette, layer.colorIndex);
  const iconNode = getIconNodeSync(layer.iconName);

  if (!iconNode) {
    // Trigger async load and request re-render
    loadIconNode(layer.iconName).then((node) => {
      if (node) onImageLoad();
    });
    // Draw placeholder while loading
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.strokeRect(layer.x, layer.y, layer.width, layer.height);
    ctx.fillStyle = color;
    ctx.font = "10px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      layer.iconName,
      layer.x + layer.width / 2,
      layer.y + layer.height / 2,
    );
    ctx.textAlign = "start";
    return;
  }

  // Render the actual Lucide SVG paths, scaled to fit the layer bounds.
  // Lucide icons use a 24x24 viewBox with stroke-based drawing.
  ctx.save();
  ctx.translate(layer.x, layer.y);
  ctx.scale(layer.width / 24, layer.height / 24);

  ctx.strokeStyle = color;
  ctx.fillStyle = "none";
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  for (const [tag, attrs] of iconNode) {
    drawSvgElement(ctx, tag, attrs, color);
  }

  ctx.restore();
}

/**
 * Draw a single SVG element (path, circle, rect, line, polyline, polygon, ellipse)
 * onto a Canvas 2D context. Assumes the context is already set up with
 * the correct stroke/fill and scaled to the 24x24 coordinate system.
 */
function drawSvgElement(
  ctx: CanvasRenderingContext2D,
  tag: string,
  attrs: Record<string, string>,
  color: string,
) {
  switch (tag) {
    case "path": {
      const d = attrs.d;
      if (!d) break;
      const p = new Path2D(d);
      if (attrs.fill && attrs.fill !== "none") {
        ctx.fillStyle = attrs.fill === "currentColor" ? color : attrs.fill;
        ctx.fill(p);
      }
      ctx.stroke(p);
      break;
    }
    case "circle": {
      const cx = parseFloat(attrs.cx ?? "0");
      const cy = parseFloat(attrs.cy ?? "0");
      const r = parseFloat(attrs.r ?? "0");
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      if (attrs.fill && attrs.fill !== "none") {
        ctx.fillStyle = attrs.fill === "currentColor" ? color : attrs.fill;
        ctx.fill();
      }
      ctx.stroke();
      break;
    }
    case "rect": {
      const x = parseFloat(attrs.x ?? "0");
      const y = parseFloat(attrs.y ?? "0");
      const w = parseFloat(attrs.width ?? "0");
      const h = parseFloat(attrs.height ?? "0");
      const rx = parseFloat(attrs.rx ?? "0");
      if (rx > 0) {
        const p = new Path2D();
        p.roundRect(x, y, w, h, rx);
        if (attrs.fill && attrs.fill !== "none") {
          ctx.fillStyle = attrs.fill === "currentColor" ? color : attrs.fill;
          ctx.fill(p);
        }
        ctx.stroke(p);
      } else {
        if (attrs.fill && attrs.fill !== "none") {
          ctx.fillStyle = attrs.fill === "currentColor" ? color : attrs.fill;
          ctx.fillRect(x, y, w, h);
        }
        ctx.strokeRect(x, y, w, h);
      }
      break;
    }
    case "line": {
      const x1 = parseFloat(attrs.x1 ?? "0");
      const y1 = parseFloat(attrs.y1 ?? "0");
      const x2 = parseFloat(attrs.x2 ?? "0");
      const y2 = parseFloat(attrs.y2 ?? "0");
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      break;
    }
    case "polyline":
    case "polygon": {
      const points = (attrs.points ?? "")
        .trim()
        .split(/[\s,]+/)
        .map(Number);
      if (points.length < 4) break;
      ctx.beginPath();
      ctx.moveTo(points[0], points[1]);
      for (let i = 2; i < points.length; i += 2) {
        ctx.lineTo(points[i], points[i + 1]);
      }
      if (tag === "polygon") ctx.closePath();
      if (attrs.fill && attrs.fill !== "none") {
        ctx.fillStyle = attrs.fill === "currentColor" ? color : attrs.fill;
        ctx.fill();
      }
      ctx.stroke();
      break;
    }
    case "ellipse": {
      const cx = parseFloat(attrs.cx ?? "0");
      const cy = parseFloat(attrs.cy ?? "0");
      const rx = parseFloat(attrs.rx ?? "0");
      const ry = parseFloat(attrs.ry ?? "0");
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      if (attrs.fill && attrs.fill !== "none") {
        ctx.fillStyle = attrs.fill === "currentColor" ? color : attrs.fill;
        ctx.fill();
      }
      ctx.stroke();
      break;
    }
  }
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
