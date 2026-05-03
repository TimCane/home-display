/**
 * Inline properties bar shown below the header when a layer is selected.
 * Allows editing type-specific properties like color, font, fill mode, etc.
 */

import { useEditorStore } from "./state/store";
import type { Layer } from "./state/types";
import { DEFAULT_PALETTE } from "../../../shared/palette";

function ColorPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (idx: number) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      {DEFAULT_PALETTE.map((c, i) => (
        <button
          key={i}
          onClick={() => onChange(i)}
          className={`h-6 w-6 rounded border-2 ${
            i === value ? "border-blue-500" : "border-neutral-300"
          }`}
          style={{ backgroundColor: `rgb(${c.r},${c.g},${c.b})` }}
          title={`Color ${i}`}
        />
      ))}
    </div>
  );
}

export function PropertiesBar() {
  const selectedId = useEditorStore((s) => s.selectedId);
  const layers = useEditorStore((s) => s.layers);
  const updateLayer = useEditorStore((s) => s.updateLayer);
  const commitHistory = useEditorStore((s) => s.commitHistory);

  const layer = layers.find((l) => l.id === selectedId);
  if (!layer) return null;

  const update = (patch: Partial<Layer>) => {
    updateLayer(layer.id, patch);
    commitHistory();
  };

  return (
    <div className="flex items-center gap-4 border-b bg-muted/50 px-4 py-1.5 text-sm">
      <span className="font-medium capitalize text-muted-foreground">
        {layer.type}
      </span>

      {/* Position */}
      <label className="flex items-center gap-1">
        X
        <input
          type="number"
          value={Math.round(layer.x)}
          onChange={(e) => update({ x: Number(e.target.value) } as Partial<Layer>)}
          className="w-16 rounded border bg-background px-1 py-0.5 text-xs"
        />
      </label>
      <label className="flex items-center gap-1">
        Y
        <input
          type="number"
          value={Math.round(layer.y)}
          onChange={(e) => update({ y: Number(e.target.value) } as Partial<Layer>)}
          className="w-16 rounded border bg-background px-1 py-0.5 text-xs"
        />
      </label>
      <label className="flex items-center gap-1">
        W
        <input
          type="number"
          value={Math.round(layer.width)}
          onChange={(e) =>
            update({ width: Math.max(1, Number(e.target.value)) } as Partial<Layer>)
          }
          className="w-16 rounded border bg-background px-1 py-0.5 text-xs"
        />
      </label>
      <label className="flex items-center gap-1">
        H
        <input
          type="number"
          value={Math.round(layer.height)}
          onChange={(e) =>
            update({ height: Math.max(1, Number(e.target.value)) } as Partial<Layer>)
          }
          className="w-16 rounded border bg-background px-1 py-0.5 text-xs"
        />
      </label>
      <label className="flex items-center gap-1">
        R
        <input
          type="number"
          value={Math.round(layer.rotation)}
          onChange={(e) =>
            update({ rotation: Number(e.target.value) } as Partial<Layer>)
          }
          className="w-16 rounded border bg-background px-1 py-0.5 text-xs"
        />
      </label>

      <div className="mx-2 h-4 w-px bg-border" />

      {/* Type-specific props */}
      {"colorIndex" in layer && (
        <ColorPicker
          value={(layer as Layer & { colorIndex: number }).colorIndex}
          onChange={(idx) => update({ colorIndex: idx } as Partial<Layer>)}
        />
      )}

      {layer.type === "text" && (
        <>
          <input
            type="text"
            value={layer.text}
            onChange={(e) => update({ text: e.target.value } as Partial<Layer>)}
            className="w-32 rounded border bg-background px-1 py-0.5 text-xs"
            placeholder="Text content"
          />
          <input
            type="number"
            value={layer.fontSize}
            onChange={(e) =>
              update({
                fontSize: Math.max(8, Number(e.target.value)),
              } as Partial<Layer>)
            }
            className="w-14 rounded border bg-background px-1 py-0.5 text-xs"
            title="Font size"
          />
        </>
      )}

      {(layer.type === "rect" || layer.type === "circle") && (
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={layer.filled}
            onChange={(e) =>
              update({ filled: e.target.checked } as Partial<Layer>)
            }
          />
          Fill
        </label>
      )}

      {(layer.type === "rect" ||
        layer.type === "circle" ||
        layer.type === "line") && (
        <label className="flex items-center gap-1">
          Stroke
          <input
            type="number"
            value={layer.strokeWidth}
            onChange={(e) =>
              update({
                strokeWidth: Math.max(1, Number(e.target.value)),
              } as Partial<Layer>)
            }
            className="w-14 rounded border bg-background px-1 py-0.5 text-xs"
          />
        </label>
      )}

      {layer.type === "icon" && (
        <input
          type="text"
          value={layer.iconName}
          onChange={(e) =>
            update({ iconName: e.target.value } as Partial<Layer>)
          }
          className="w-24 rounded border bg-background px-1 py-0.5 text-xs"
          placeholder="Icon name"
          title="Lucide icon name"
        />
      )}
    </div>
  );
}
