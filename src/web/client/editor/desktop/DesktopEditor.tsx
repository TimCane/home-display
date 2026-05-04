import { useEffect, useCallback } from "react";
import type { EditorVariantProps } from "../EditorShell";
import type { AllowedElement } from "./state/types";
import { useEditorStore } from "./state/store";
import { Canvas } from "./Canvas";
import { Toolbox } from "./Toolbox";
import { LayersPanel } from "./LayersPanel";
import { PreviewPanel } from "./PreviewPanel";
import { PropertiesBar } from "./PropertiesBar";
import { renderToFrame } from "./PreviewPanel";

export function DesktopEditor({ draft, onFrameReady }: EditorVariantProps) {
  const init = useEditorStore((s) => s.init);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const layers = useEditorStore((s) => s.layers);

  // Initialize store on mount
  useEffect(() => {
    const allowed = draft.guestMode
      ? (draft.allowedElements as AllowedElement[] | null)
      : null;
    init(allowed);
  }, [draft, init]);

  // Provide frame getter to EditorShell
  const getFrameBytes = useCallback(() => {
    return renderToFrame(layers);
  }, [layers]);

  useEffect(() => {
    onFrameReady(layers.length > 0 ? getFrameBytes : null);
  }, [layers.length, onFrameReady, getFrameBytes]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if (meta && e.key === "z" && e.shiftKey) {
        e.preventDefault();
        redo();
      }
      if (meta && e.key === "y") {
        e.preventDefault();
        redo();
      }
      // Delete selected layer
      if (e.key === "Delete" || e.key === "Backspace") {
        // Only if not focused on an input
        if (
          document.activeElement?.tagName !== "INPUT" &&
          document.activeElement?.tagName !== "TEXTAREA"
        ) {
          const { selectedId, removeLayer, commitHistory } =
            useEditorStore.getState();
          if (selectedId) {
            e.preventDefault();
            removeLayer(selectedId);
            commitHistory();
          }
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undo, redo]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <PropertiesBar />
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Toolbox */}
        <Toolbox />

        {/* Center: Canvas */}
        <Canvas />

        {/* Right: Layers + Preview */}
        <div className="flex w-52 flex-col">
          <div className="flex-1 overflow-hidden">
            <LayersPanel />
          </div>
          <PreviewPanel />
        </div>
      </div>
    </div>
  );
}
