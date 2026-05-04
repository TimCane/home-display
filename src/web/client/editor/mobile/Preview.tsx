import { useRef, useEffect, useCallback } from "react";
import { WIDTH, HEIGHT } from "../../../shared/framebuffer";
import { DEFAULT_PALETTE } from "../../../shared/palette";
import { dither } from "../../../shared/dither";
import { decode2bpp } from "../../../shared/framebuffer";
import type { MobileEditorState } from "./state";

interface PreviewProps {
  state: MobileEditorState;
  /** Expose a function that produces the final 163,200-byte framebuffer */
  onFrameReady: (getBytes: (() => Uint8Array) | null) => void;
}

/**
 * Composites image + optional text on a 960x680 offscreen canvas,
 * runs Floyd-Steinberg dither, and paints the dithered preview.
 */
export function Preview({ state, onFrameReady }: PreviewProps) {
  const previewRef = useRef<HTMLCanvasElement>(null);

  const composite = useCallback((): ImageData | null => {
    if (!state.imageSrc) return null;

    const offscreen = document.createElement("canvas");
    offscreen.width = WIDTH;
    offscreen.height = HEIGHT;
    const ctx = offscreen.getContext("2d")!;

    // White background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Draw image (already scaled to 960x680 by ImagePicker)
    const img = new Image();
    img.src = state.imageSrc;
    if (img.complete) {
      ctx.drawImage(img, 0, 0, WIDTH, HEIGHT);
    }

    // Draw text overlay (lower third, centered horizontally)
    if (state.textOverlay && state.textOverlay.text.trim()) {
      const t = state.textOverlay;
      const c = DEFAULT_PALETTE[t.colorIndex];
      ctx.fillStyle = `rgb(${c.r},${c.g},${c.b})`;
      ctx.font = `bold ${t.fontSize}px Inter, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      // Position in the lower third
      const textY = HEIGHT - Math.round(HEIGHT / 6);
      ctx.fillText(t.text, WIDTH / 2, textY, WIDTH - 40);
    }

    return ctx.getImageData(0, 0, WIDTH, HEIGHT);
  }, [state.imageSrc, state.textOverlay]);

  const getFrameBytes = useCallback((): Uint8Array => {
    const imageData = composite();
    if (!imageData) {
      throw new Error("No image loaded");
    }
    return dither(imageData.data, WIDTH, HEIGHT, DEFAULT_PALETTE);
  }, [composite]);

  // Update preview canvas
  useEffect(() => {
    const canvas = previewRef.current;
    if (!canvas || !state.imageSrc) return;

    const timeout = setTimeout(() => {
      const imageData = composite();
      if (!imageData) return;

      const frame2bpp = dither(imageData.data, WIDTH, HEIGHT, DEFAULT_PALETTE);
      const indices = decode2bpp(frame2bpp);
      const ctx = canvas.getContext("2d")!;
      const previewData = ctx.createImageData(WIDTH, HEIGHT);

      for (let i = 0; i < indices.length; i++) {
        const c = DEFAULT_PALETTE[indices[i]];
        const off = i * 4;
        previewData.data[off] = c.r;
        previewData.data[off + 1] = c.g;
        previewData.data[off + 2] = c.b;
        previewData.data[off + 3] = 255;
      }

      ctx.putImageData(previewData, 0, 0);
    }, 150);

    return () => clearTimeout(timeout);
  }, [state.imageSrc, state.textOverlay, composite]);

  // Notify parent when we can produce a frame
  useEffect(() => {
    onFrameReady(state.imageSrc ? getFrameBytes : null);
  }, [state.imageSrc, getFrameBytes, onFrameReady]);

  if (!state.imageSrc) return null;

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold uppercase text-muted-foreground">
        Dithered Preview
      </label>
      <canvas
        ref={previewRef}
        width={WIDTH}
        height={HEIGHT}
        className="w-full rounded border"
        style={{ imageRendering: "pixelated" }}
      />
    </div>
  );
}
