import { useRef, useEffect, useCallback, useState } from "react";
import { WIDTH, HEIGHT } from "../../../shared/framebuffer";
import { DEFAULT_PALETTE } from "../../../shared/palette";
import { dither } from "../../../shared/dither";
import { decode2bpp } from "../../../shared/framebuffer";
import { useEditorStore } from "./state/store";
import { renderLayer } from "./layers/render";

/**
 * Preview panel that shows a live dithered preview of the canvas.
 * Pipeline: render layers to offscreen canvas -> getImageData -> dither -> decode -> paint with palette colors.
 */
export function PreviewPanel() {
  const previewRef = useRef<HTMLCanvasElement>(null);
  const layers = useEditorStore((s) => s.layers);
  const [collapsed, setCollapsed] = useState(false);

  const updatePreview = useCallback(() => {
    const previewCanvas = previewRef.current;
    if (!previewCanvas) return;

    // Render layers to offscreen canvas
    const offscreen = document.createElement("canvas");
    offscreen.width = WIDTH;
    offscreen.height = HEIGHT;
    const offCtx = offscreen.getContext("2d")!;

    // White background if no background layer
    const hasBg = layers.some((l) => l.type === "background" && l.visible);
    if (!hasBg) {
      offCtx.fillStyle = "#ffffff";
      offCtx.fillRect(0, 0, WIDTH, HEIGHT);
    }

    const sorted = [...layers].sort((a, b) => a.z - b.z);
    for (const layer of sorted) {
      renderLayer(offCtx, layer, DEFAULT_PALETTE, () => {});
    }

    // Get RGBA data and dither
    const imageData = offCtx.getImageData(0, 0, WIDTH, HEIGHT);
    const frame2bpp = dither(imageData.data, WIDTH, HEIGHT, DEFAULT_PALETTE);

    // Decode 2bpp back to indices and paint with palette colors
    const indices = decode2bpp(frame2bpp);
    const previewCtx = previewCanvas.getContext("2d")!;
    const previewData = previewCtx.createImageData(WIDTH, HEIGHT);

    for (let i = 0; i < indices.length; i++) {
      const c = DEFAULT_PALETTE[indices[i]];
      const off = i * 4;
      previewData.data[off] = c.r;
      previewData.data[off + 1] = c.g;
      previewData.data[off + 2] = c.b;
      previewData.data[off + 3] = 255;
    }

    previewCtx.putImageData(previewData, 0, 0);
  }, [layers]);

  useEffect(() => {
    if (collapsed) return;
    // Debounce preview updates
    const timeout = setTimeout(updatePreview, 100);
    return () => clearTimeout(timeout);
  }, [updatePreview, collapsed]);

  return (
    <div className="flex flex-col border-t">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold uppercase text-muted-foreground hover:bg-muted"
      >
        <span>{collapsed ? "+" : "-"}</span>
        Dither Preview
      </button>
      {!collapsed && (
        <div className="p-2">
          <canvas
            ref={previewRef}
            width={WIDTH}
            height={HEIGHT}
            className="w-full border"
            style={{ imageRendering: "pixelated" }}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Produce the final 163,200-byte 2bpp framebuffer from current layers.
 * Used by the commit pipeline.
 */
export function renderToFrame(layers: import("./state/types").Layer[]): Uint8Array {
  const offscreen = document.createElement("canvas");
  offscreen.width = WIDTH;
  offscreen.height = HEIGHT;
  const ctx = offscreen.getContext("2d")!;

  const hasBg = layers.some((l) => l.type === "background" && l.visible);
  if (!hasBg) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }

  const sorted = [...layers].sort((a, b) => a.z - b.z);
  for (const layer of sorted) {
    renderLayer(ctx, layer, DEFAULT_PALETTE, () => {});
  }

  const imageData = ctx.getImageData(0, 0, WIDTH, HEIGHT);
  return dither(imageData.data, WIDTH, HEIGHT, DEFAULT_PALETTE);
}
