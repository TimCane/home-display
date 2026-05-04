import { useRef, useCallback } from "react";
import { MAX_FILE_SIZE, ACCEPTED_TYPES } from "./state";
import { WIDTH, HEIGHT } from "../../../shared/framebuffer";

interface ImagePickerProps {
  imageSrc: string | null;
  onImageSelected: (
    src: string,
    naturalWidth: number,
    naturalHeight: number,
  ) => void;
}

/**
 * Image picker for the mobile editor.
 * Accepts camera roll / file upload, decodes and downscales to fit 960x680.
 */
export function ImagePicker({ imageSrc, onImageSelected }: ImagePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      if (!ACCEPTED_TYPES.includes(file.type) && !file.name.match(/\.heic$/i)) {
        alert("Unsupported file type. Please use JPEG, PNG, WebP, or HEIC.");
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        alert("File too large. Maximum size is 20 MB.");
        return;
      }

      try {
        const bitmap = await createImageBitmap(file);
        const { width: natW, height: natH } = bitmap;

        // Downscale to fit within 960x680, preserving aspect ratio
        const scale = Math.min(1, WIDTH / natW, HEIGHT / natH);
        const drawW = Math.round(natW * scale);
        const drawH = Math.round(natH * scale);

        // Draw scaled image centered on a 960x680 white canvas
        const canvas = document.createElement("canvas");
        canvas.width = WIDTH;
        canvas.height = HEIGHT;
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, WIDTH, HEIGHT);

        const offsetX = Math.round((WIDTH - drawW) / 2);
        const offsetY = Math.round((HEIGHT - drawH) / 2);
        ctx.drawImage(bitmap, offsetX, offsetY, drawW, drawH);
        bitmap.close();

        // Convert to blob URL for display
        const blob = await new Promise<Blob>((resolve) =>
          canvas.toBlob((b) => resolve(b!), "image/png"),
        );
        const url = URL.createObjectURL(blob);

        onImageSelected(url, WIDTH, HEIGHT);
      } catch {
        alert("Could not load image. Please try a different file.");
      }
    },
    [onImageSelected],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      // Reset input so the same file can be re-selected
      e.target.value = "";
    },
    [handleFile],
  );

  return (
    <div className="flex flex-col items-center gap-3">
      {imageSrc ? (
        <button
          onClick={() => inputRef.current?.click()}
          className="w-full rounded border-2 border-dashed border-muted-foreground/30 p-1"
        >
          <img
            src={imageSrc}
            alt="Selected"
            className="w-full rounded"
            style={{ imageRendering: "auto" }}
          />
          <span className="mt-1 block text-xs text-muted-foreground">
            Tap to change image
          </span>
        </button>
      ) : (
        <button
          onClick={() => inputRef.current?.click()}
          className="flex w-full flex-col items-center justify-center gap-2 rounded border-2 border-dashed border-muted-foreground/30 py-12"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-muted-foreground"
          >
            <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
            <circle cx="9" cy="9" r="2" />
            <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
          </svg>
          <span className="text-sm font-medium text-muted-foreground">
            Choose an image
          </span>
          <span className="text-xs text-muted-foreground/70">
            JPEG, PNG, WebP, or HEIC (max 20 MB)
          </span>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleChange}
        className="hidden"
      />
    </div>
  );
}
