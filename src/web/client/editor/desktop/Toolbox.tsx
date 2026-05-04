import {
  MousePointer2,
  Image,
  Type,
  Square,
  Minus,
  Circle,
  Smile,
  PaintBucket,
} from "lucide-react";
import { useEditorStore, genId } from "./state/store";
import type { Tool, Layer, AllowedElement } from "./state/types";
import { WIDTH, HEIGHT } from "../../../shared/framebuffer";
import { useRef, useCallback } from "react";

const TOOL_CONFIG: {
  tool: Tool;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}[] = [
  { tool: "select", icon: MousePointer2, label: "Select" },
  { tool: "background", icon: PaintBucket, label: "Background" },
  { tool: "image", icon: Image, label: "Image" },
  { tool: "text", icon: Type, label: "Text" },
  { tool: "rect", icon: Square, label: "Rectangle" },
  { tool: "line", icon: Minus, label: "Line" },
  { tool: "circle", icon: Circle, label: "Circle" },
  { tool: "icon", icon: Smile, label: "Icon" },
];

function nextZ(layers: Layer[]): number {
  return layers.length === 0 ? 0 : Math.max(...layers.map((l) => l.z)) + 1;
}

export function Toolbox() {
  const activeTool = useEditorStore((s) => s.activeTool);
  const setTool = useEditorStore((s) => s.setTool);
  const addLayer = useEditorStore((s) => s.addLayer);
  const layers = useEditorStore((s) => s.layers);
  const commitHistory = useEditorStore((s) => s.commitHistory);
  const allowedTools = useEditorStore((s) => s.allowedTools);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageFile = useCallback(
    (file: File) => {
      const url = URL.createObjectURL(file);
      const img = new window.Image();
      img.onload = () => {
        // Scale to fit canvas while preserving aspect ratio
        let w = img.naturalWidth;
        let h = img.naturalHeight;
        const maxW = WIDTH;
        const maxH = HEIGHT;
        if (w > maxW || h > maxH) {
          const ratio = Math.min(maxW / w, maxH / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }
        const layer: Layer = {
          id: genId(),
          type: "image",
          x: Math.round((WIDTH - w) / 2),
          y: Math.round((HEIGHT - h) / 2),
          width: w,
          height: h,
          rotation: 0,
          visible: true,
          z: nextZ(layers),
          src: url,
          naturalWidth: img.naturalWidth,
          naturalHeight: img.naturalHeight,
        };
        addLayer(layer);
        commitHistory();
        setTool("select");
      };
      img.src = url;
    },
    [addLayer, commitHistory, layers, setTool],
  );

  const handleToolClick = useCallback(
    (tool: Tool) => {
      if (tool === "select") {
        setTool("select");
        return;
      }

      if (tool === "image") {
        fileInputRef.current?.click();
        return;
      }

      if (tool === "background") {
        // Toggle or add background layer
        const existing = layers.find((l) => l.type === "background");
        if (existing) {
          // Cycle color
          const nextColor = ((existing as Layer & { type: "background" }).colorIndex + 1) % 4;
          const { updateLayer } = useEditorStore.getState();
          updateLayer(existing.id, { colorIndex: nextColor } as Partial<Layer>);
          commitHistory();
        } else {
          const layer: Layer = {
            id: genId(),
            type: "background",
            x: 0,
            y: 0,
            width: WIDTH,
            height: HEIGHT,
            rotation: 0,
            visible: true,
            z: -1, // always behind everything
            colorIndex: 1, // white
          };
          addLayer(layer);
          commitHistory();
        }
        return;
      }

      // For shape/text/icon tools, add a default layer at center
      const z = nextZ(layers);
      let layer: Layer;

      switch (tool) {
        case "text":
          layer = {
            id: genId(),
            type: "text",
            x: WIDTH / 2 - 100,
            y: HEIGHT / 2 - 20,
            width: 200,
            height: 40,
            rotation: 0,
            visible: true,
            z,
            text: "Text",
            fontFamily: "Inter, sans-serif",
            fontSize: 32,
            colorIndex: 0,
          };
          break;
        case "rect":
          layer = {
            id: genId(),
            type: "rect",
            x: WIDTH / 2 - 75,
            y: HEIGHT / 2 - 50,
            width: 150,
            height: 100,
            rotation: 0,
            visible: true,
            z,
            colorIndex: 0,
            filled: true,
            strokeWidth: 2,
          };
          break;
        case "line":
          layer = {
            id: genId(),
            type: "line",
            x: WIDTH / 2 - 75,
            y: HEIGHT / 2,
            width: 150,
            height: 0,
            rotation: 0,
            visible: true,
            z,
            colorIndex: 0,
            strokeWidth: 2,
          };
          break;
        case "circle":
          layer = {
            id: genId(),
            type: "circle",
            x: WIDTH / 2 - 50,
            y: HEIGHT / 2 - 50,
            width: 100,
            height: 100,
            rotation: 0,
            visible: true,
            z,
            colorIndex: 0,
            filled: true,
            strokeWidth: 2,
          };
          break;
        case "icon":
          layer = {
            id: genId(),
            type: "icon",
            x: WIDTH / 2 - 24,
            y: HEIGHT / 2 - 24,
            width: 48,
            height: 48,
            rotation: 0,
            visible: true,
            z,
            iconName: "star",
            colorIndex: 0,
          };
          break;
        default:
          return;
      }

      addLayer(layer);
      commitHistory();
      setTool("select");
    },
    [addLayer, commitHistory, layers, setTool],
  );

  const visibleTools = allowedTools
    ? TOOL_CONFIG.filter((t) => allowedTools.includes(t.tool))
    : TOOL_CONFIG;

  return (
    <div className="flex w-14 flex-col items-center gap-1 border-r bg-background py-2">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleImageFile(file);
          e.target.value = "";
        }}
      />
      {visibleTools.map(({ tool, icon: Icon, label }) => (
        <button
          key={tool}
          title={label}
          onClick={() => handleToolClick(tool)}
          className={`flex h-10 w-10 items-center justify-center rounded transition-colors ${
            activeTool === tool
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted"
          }`}
        >
          <Icon className="h-5 w-5" />
        </button>
      ))}
    </div>
  );
}
