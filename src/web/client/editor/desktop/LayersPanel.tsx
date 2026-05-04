import { Eye, EyeOff, Trash2, GripVertical } from "lucide-react";
import { useEditorStore } from "./state/store";
import { useCallback, useRef } from "react";
import type { Layer } from "./state/types";

const TYPE_LABELS: Record<Layer["type"], string> = {
  background: "Background",
  image: "Image",
  text: "Text",
  rect: "Rectangle",
  line: "Line",
  circle: "Circle",
  icon: "Icon",
};

export function LayersPanel() {
  const layers = useEditorStore((s) => s.layers);
  const selectedId = useEditorStore((s) => s.selectedId);
  const selectLayer = useEditorStore((s) => s.selectLayer);
  const toggleVisibility = useEditorStore((s) => s.toggleVisibility);
  const removeLayer = useEditorStore((s) => s.removeLayer);
  const reorderLayer = useEditorStore((s) => s.reorderLayer);
  const commitHistory = useEditorStore((s) => s.commitHistory);

  const dragItemRef = useRef<string | null>(null);
  const dragOverRef = useRef<string | null>(null);

  // Show layers top → bottom in z descending
  const sorted = [...layers].sort((a, b) => b.z - a.z);

  const handleDragStart = useCallback((id: string) => {
    dragItemRef.current = id;
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent, id: string) => {
      e.preventDefault();
      dragOverRef.current = id;
    },
    [],
  );

  const handleDrop = useCallback(() => {
    const fromId = dragItemRef.current;
    const toId = dragOverRef.current;
    if (!fromId || !toId || fromId === toId) return;

    const toLayer = layers.find((l) => l.id === toId);
    if (toLayer) {
      reorderLayer(fromId, toLayer.z);
      commitHistory();
    }

    dragItemRef.current = null;
    dragOverRef.current = null;
  }, [layers, reorderLayer, commitHistory]);

  const handleDelete = useCallback(
    (id: string) => {
      removeLayer(id);
      commitHistory();
    },
    [removeLayer, commitHistory],
  );

  const handleToggle = useCallback(
    (id: string) => {
      toggleVisibility(id);
      commitHistory();
    },
    [toggleVisibility, commitHistory],
  );

  return (
    <div className="flex w-52 flex-col border-l bg-background">
      <div className="border-b px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">
        Layers
      </div>
      <div className="flex-1 overflow-y-auto">
        {sorted.length === 0 && (
          <p className="p-3 text-xs text-muted-foreground">
            No layers yet. Use the toolbar to add elements.
          </p>
        )}
        {sorted.map((layer) => {
          const isSelected = layer.id === selectedId;
          const label =
            layer.type === "text"
              ? `"${layer.text.slice(0, 16)}"`
              : layer.type === "icon"
                ? layer.iconName
                : TYPE_LABELS[layer.type];

          return (
            <div
              key={layer.id}
              draggable
              onDragStart={() => handleDragStart(layer.id)}
              onDragOver={(e) => handleDragOver(e, layer.id)}
              onDrop={handleDrop}
              onClick={() => selectLayer(layer.id)}
              className={`flex items-center gap-1 px-2 py-1.5 text-xs cursor-pointer border-b transition-colors ${
                isSelected
                  ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                  : "hover:bg-muted"
              }`}
            >
              <GripVertical className="h-3 w-3 shrink-0 cursor-grab text-muted-foreground" />
              <span className="flex-1 truncate">{label}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggle(layer.id);
                }}
                className="p-0.5 text-muted-foreground hover:text-foreground"
                title={layer.visible ? "Hide" : "Show"}
              >
                {layer.visible ? (
                  <Eye className="h-3.5 w-3.5" />
                ) : (
                  <EyeOff className="h-3.5 w-3.5" />
                )}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(layer.id);
                }}
                className="p-0.5 text-muted-foreground hover:text-red-500"
                title="Delete"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
