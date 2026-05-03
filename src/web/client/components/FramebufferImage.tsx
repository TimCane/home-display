import { useEffect, useRef, useState } from "react";
import { decode2bpp, WIDTH, HEIGHT } from "../../shared/framebuffer";
import { DEFAULT_PALETTE } from "../../shared/palette";
import { cn } from "../lib/utils";

interface FramebufferImageProps {
  entryId: string;
  updatedAt?: string | Date;
  className?: string;
}

/**
 * Fetches /api/framebuffer/:id, decodes 2bpp data, and paints to a canvas.
 * Re-fetches when updatedAt changes.
 */
export function FramebufferImage({
  entryId,
  updatedAt,
  className,
}: FramebufferImageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(`/api/framebuffer/${entryId}`, {
          credentials: "include",
        });
        if (!res.ok || cancelled) return;

        const buf = new Uint8Array(await res.arrayBuffer());
        const indices = decode2bpp(buf);
        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;

        canvas.width = WIDTH;
        canvas.height = HEIGHT;
        const ctx = canvas.getContext("2d")!;
        const imageData = ctx.createImageData(WIDTH, HEIGHT);
        const data = imageData.data;

        for (let i = 0; i < indices.length; i++) {
          const color = DEFAULT_PALETTE[indices[i]];
          const offset = i * 4;
          data[offset] = color.r;
          data[offset + 1] = color.g;
          data[offset + 2] = color.b;
          data[offset + 3] = 255;
        }

        ctx.putImageData(imageData, 0, 0);
        setError(false);
      } catch {
        if (!cancelled) setError(true);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [entryId, updatedAt]);

  if (error) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-muted text-muted-foreground text-xs rounded",
          className,
        )}
        style={{ aspectRatio: `${WIDTH}/${HEIGHT}` }}
      >
        Failed to load
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      className={cn("rounded", className)}
      style={{ width: "100%", height: "auto", aspectRatio: `${WIDTH}/${HEIGHT}` }}
    />
  );
}
