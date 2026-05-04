import type { TextOverlayState } from "./state";
import { DEFAULT_PALETTE } from "../../../shared/palette";

interface TextOverlayProps {
  value: TextOverlayState;
  onChange: (value: TextOverlayState) => void;
}

/**
 * Single text overlay controls: text input, size slider, palette color picker.
 * Position is fixed (lower third) — no dragging in V1.
 */
export function TextOverlay({ value, onChange }: TextOverlayProps) {
  return (
    <div className="flex flex-col gap-2 rounded border bg-card p-3">
      <label className="text-xs font-semibold uppercase text-muted-foreground">
        Text Overlay
      </label>
      <input
        type="text"
        value={value.text}
        onChange={(e) => onChange({ ...value, text: e.target.value })}
        placeholder="Enter text..."
        className="rounded border bg-background px-3 py-2 text-sm"
        maxLength={100}
      />

      {/* Size slider */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground w-8">Size</span>
        <input
          type="range"
          min={16}
          max={96}
          value={value.fontSize}
          onChange={(e) =>
            onChange({ ...value, fontSize: Number(e.target.value) })
          }
          className="flex-1"
        />
        <span className="text-xs text-muted-foreground w-6 text-right">
          {value.fontSize}
        </span>
      </div>

      {/* Palette color picker */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground w-8">Color</span>
        <div className="flex gap-1.5">
          {DEFAULT_PALETTE.map((c, i) => (
            <button
              key={i}
              onClick={() => onChange({ ...value, colorIndex: i })}
              className={`h-7 w-7 rounded border-2 ${
                value.colorIndex === i
                  ? "border-blue-500 ring-1 ring-blue-500"
                  : "border-muted-foreground/30"
              }`}
              style={{ backgroundColor: `rgb(${c.r},${c.g},${c.b})` }}
              title={`Color ${i}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
