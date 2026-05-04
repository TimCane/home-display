/**
 * Snap-to-edge / snap-to-center alignment guides.
 */

import { WIDTH, HEIGHT } from "../../../shared/framebuffer";
import type { Layer } from "./state/types";

const SNAP_THRESHOLD = 6; // px

export interface SnapResult {
  x: number;
  y: number;
  guides: GuideLine[];
}

export interface GuideLine {
  axis: "x" | "y";
  position: number; // px along that axis
}

interface Edge {
  left: number;
  right: number;
  top: number;
  bottom: number;
  centerX: number;
  centerY: number;
}

function layerEdge(l: Layer): Edge {
  return {
    left: l.x,
    right: l.x + l.width,
    top: l.y,
    bottom: l.y + l.height,
    centerX: l.x + l.width / 2,
    centerY: l.y + l.height / 2,
  };
}

/**
 * Given a layer being dragged to (x, y), compute snapped position
 * and guide lines to render.
 */
export function computeSnap(
  draggedId: string,
  x: number,
  y: number,
  width: number,
  height: number,
  allLayers: Layer[],
): SnapResult {
  const guides: GuideLine[] = [];

  // Candidate snap points for dragged layer
  const dragLeft = x;
  const dragRight = x + width;
  const dragCenterX = x + width / 2;
  const dragTop = y;
  const dragBottom = y + height;
  const dragCenterY = y + height / 2;

  // Anchor points: canvas edges/center + other layers
  const xAnchors: number[] = [0, WIDTH / 2, WIDTH];
  const yAnchors: number[] = [0, HEIGHT / 2, HEIGHT];

  for (const l of allLayers) {
    if (l.id === draggedId || !l.visible) continue;
    const e = layerEdge(l);
    xAnchors.push(e.left, e.right, e.centerX);
    yAnchors.push(e.top, e.bottom, e.centerY);
  }

  let snappedX = x;
  let snappedY = y;

  // Snap X
  let bestDx = SNAP_THRESHOLD + 1;
  for (const anchor of xAnchors) {
    for (const edge of [dragLeft, dragRight, dragCenterX]) {
      const d = Math.abs(edge - anchor);
      if (d < bestDx) {
        bestDx = d;
        snappedX = x + (anchor - edge);
        guides.length = 0; // reset x guides
        guides.push({ axis: "x", position: anchor });
      } else if (d === bestDx && d <= SNAP_THRESHOLD) {
        guides.push({ axis: "x", position: anchor });
      }
    }
  }
  if (bestDx > SNAP_THRESHOLD) {
    // No x snap — remove any x guides
    for (let i = guides.length - 1; i >= 0; i--) {
      if (guides[i].axis === "x") guides.splice(i, 1);
    }
  }

  // Snap Y
  let bestDy = SNAP_THRESHOLD + 1;
  const yGuides: GuideLine[] = [];
  for (const anchor of yAnchors) {
    for (const edge of [dragTop, dragBottom, dragCenterY]) {
      const d = Math.abs(edge - anchor);
      if (d < bestDy) {
        bestDy = d;
        snappedY = y + (anchor - edge);
        yGuides.length = 0;
        yGuides.push({ axis: "y", position: anchor });
      } else if (d === bestDy && d <= SNAP_THRESHOLD) {
        yGuides.push({ axis: "y", position: anchor });
      }
    }
  }
  if (bestDy <= SNAP_THRESHOLD) {
    guides.push(...yGuides);
  }

  return { x: snappedX, y: snappedY, guides };
}
