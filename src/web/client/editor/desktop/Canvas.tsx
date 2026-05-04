import { useRef, useEffect, useCallback, useState } from "react";
import { WIDTH, HEIGHT } from "../../../shared/framebuffer";
import { DEFAULT_PALETTE } from "../../../shared/palette";
import { useEditorStore } from "./state/store";
import { renderLayer, renderSelection, renderGuides } from "./layers/render";
import { computeSnap, type GuideLine } from "./snapping";
import type { Layer } from "./state/types";

type DragMode = "move" | "resize" | "rotate" | null;
type ResizeCorner = "tl" | "tr" | "bl" | "br";

interface DragState {
  mode: DragMode;
  layerId: string;
  startMouseX: number;
  startMouseY: number;
  startLayerX: number;
  startLayerY: number;
  startWidth: number;
  startHeight: number;
  startRotation: number;
  corner?: ResizeCorner;
}

const HANDLE_SIZE = 8;

function hitTestHandles(
  layer: Layer,
  mx: number,
  my: number,
): "rotate" | ResizeCorner | null {
  // Rotate handle
  const rotateX = layer.x + layer.width / 2;
  const rotateY = layer.y - 24;
  if (Math.hypot(mx - rotateX, my - rotateY) < 8) return "rotate";

  // Corner handles
  const corners: [number, number, ResizeCorner][] = [
    [layer.x, layer.y, "tl"],
    [layer.x + layer.width, layer.y, "tr"],
    [layer.x, layer.y + layer.height, "bl"],
    [layer.x + layer.width, layer.y + layer.height, "br"],
  ];
  for (const [hx, hy, corner] of corners) {
    if (
      Math.abs(mx - hx) <= HANDLE_SIZE &&
      Math.abs(my - hy) <= HANDLE_SIZE
    ) {
      return corner;
    }
  }
  return null;
}

function hitTestLayer(layer: Layer, mx: number, my: number): boolean {
  if (!layer.visible) return false;
  if (layer.type === "background") return false; // background can't be selected via canvas click
  return (
    mx >= layer.x &&
    mx <= layer.x + layer.width &&
    my >= layer.y &&
    my <= layer.y + layer.height
  );
}

export function Canvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [guides, setGuides] = useState<GuideLine[]>([]);
  const dragRef = useRef<DragState | null>(null);

  const layers = useEditorStore((s) => s.layers);
  const selectedId = useEditorStore((s) => s.selectedId);
  const selectLayer = useEditorStore((s) => s.selectLayer);
  const updateLayer = useEditorStore((s) => s.updateLayer);
  const commitHistory = useEditorStore((s) => s.commitHistory);

  // Fit canvas into container
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => {
      const { width, height } = container.getBoundingClientRect();
      const s = Math.min(width / WIDTH, height / HEIGHT, 1);
      setScale(s);
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  // Render loop
  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, WIDTH, HEIGHT);

    // Fill with white if no background layer
    const hasBg = layers.some((l) => l.type === "background" && l.visible);
    if (!hasBg) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
    }

    // Render layers in z order
    const sorted = [...layers].sort((a, b) => a.z - b.z);
    for (const layer of sorted) {
      renderLayer(ctx, layer, DEFAULT_PALETTE, paint);
    }

    // Selection overlay
    const selected = layers.find((l) => l.id === selectedId);
    if (selected) {
      renderSelection(ctx, selected);
    }

    // Snap guides
    if (guides.length > 0) {
      renderGuides(ctx, guides);
    }
  }, [layers, selectedId, guides]);

  useEffect(() => {
    paint();
  }, [paint]);

  // Convert mouse event to canvas coords
  const toCanvasCoords = useCallback(
    (e: React.MouseEvent): [number, number] => {
      const canvas = canvasRef.current;
      if (!canvas) return [0, 0];
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) / scale;
      const y = (e.clientY - rect.top) / scale;
      return [x, y];
    },
    [scale],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const [mx, my] = toCanvasCoords(e);

      // If a layer is selected, check handles first
      const selected = layers.find((l) => l.id === selectedId);
      if (selected) {
        const handle = hitTestHandles(selected, mx, my);
        if (handle === "rotate") {
          dragRef.current = {
            mode: "rotate",
            layerId: selected.id,
            startMouseX: mx,
            startMouseY: my,
            startLayerX: selected.x,
            startLayerY: selected.y,
            startWidth: selected.width,
            startHeight: selected.height,
            startRotation: selected.rotation,
          };
          return;
        }
        if (handle) {
          dragRef.current = {
            mode: "resize",
            layerId: selected.id,
            startMouseX: mx,
            startMouseY: my,
            startLayerX: selected.x,
            startLayerY: selected.y,
            startWidth: selected.width,
            startHeight: selected.height,
            startRotation: selected.rotation,
            corner: handle,
          };
          return;
        }
      }

      // Hit test layers (top-most first, i.e. highest z)
      const sorted = [...layers]
        .filter((l) => l.visible)
        .sort((a, b) => b.z - a.z);
      for (const layer of sorted) {
        if (hitTestLayer(layer, mx, my)) {
          selectLayer(layer.id);
          dragRef.current = {
            mode: "move",
            layerId: layer.id,
            startMouseX: mx,
            startMouseY: my,
            startLayerX: layer.x,
            startLayerY: layer.y,
            startWidth: layer.width,
            startHeight: layer.height,
            startRotation: layer.rotation,
          };
          return;
        }
      }

      // Clicked empty space
      selectLayer(null);
    },
    [layers, selectedId, selectLayer, toCanvasCoords],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return;

      const [mx, my] = toCanvasCoords(e);
      const dx = mx - drag.startMouseX;
      const dy = my - drag.startMouseY;

      if (drag.mode === "move") {
        const rawX = drag.startLayerX + dx;
        const rawY = drag.startLayerY + dy;
        const snap = computeSnap(
          drag.layerId,
          rawX,
          rawY,
          drag.startWidth,
          drag.startHeight,
          layers,
        );
        updateLayer(drag.layerId, { x: snap.x, y: snap.y } as Partial<Layer>);
        setGuides(snap.guides);
      } else if (drag.mode === "resize" && drag.corner) {
        let newX = drag.startLayerX;
        let newY = drag.startLayerY;
        let newW = drag.startWidth;
        let newH = drag.startHeight;

        switch (drag.corner) {
          case "br":
            newW = Math.max(10, drag.startWidth + dx);
            newH = Math.max(10, drag.startHeight + dy);
            break;
          case "bl":
            newX = drag.startLayerX + dx;
            newW = Math.max(10, drag.startWidth - dx);
            newH = Math.max(10, drag.startHeight + dy);
            break;
          case "tr":
            newY = drag.startLayerY + dy;
            newW = Math.max(10, drag.startWidth + dx);
            newH = Math.max(10, drag.startHeight - dy);
            break;
          case "tl":
            newX = drag.startLayerX + dx;
            newY = drag.startLayerY + dy;
            newW = Math.max(10, drag.startWidth - dx);
            newH = Math.max(10, drag.startHeight - dy);
            break;
        }

        updateLayer(drag.layerId, {
          x: newX,
          y: newY,
          width: newW,
          height: newH,
        } as Partial<Layer>);
      } else if (drag.mode === "rotate") {
        const cx = drag.startLayerX + drag.startWidth / 2;
        const cy = drag.startLayerY + drag.startHeight / 2;
        const startAngle = Math.atan2(
          drag.startMouseY - cy,
          drag.startMouseX - cx,
        );
        const currentAngle = Math.atan2(my - cy, mx - cx);
        const delta = ((currentAngle - startAngle) * 180) / Math.PI;
        updateLayer(drag.layerId, {
          rotation: drag.startRotation + delta,
        } as Partial<Layer>);
      }
    },
    [toCanvasCoords, layers, updateLayer],
  );

  const handleMouseUp = useCallback(() => {
    if (dragRef.current) {
      commitHistory();
      dragRef.current = null;
      setGuides([]);
    }
  }, [commitHistory]);

  return (
    <div
      ref={containerRef}
      className="flex flex-1 items-center justify-center overflow-hidden bg-neutral-800"
    >
      <canvas
        ref={canvasRef}
        width={WIDTH}
        height={HEIGHT}
        style={{
          width: WIDTH * scale,
          height: HEIGHT * scale,
          cursor: dragRef.current ? "grabbing" : "default",
        }}
        className="shadow-lg"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />
    </div>
  );
}
