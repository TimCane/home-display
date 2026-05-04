/**
 * Zustand store for the desktop editor.
 * Manages layers, selection, active tool, and undo/redo history.
 */

import { create } from "zustand";
import type { Layer, Tool, AllowedElement } from "./types";
import { WIDTH, HEIGHT } from "../../../../shared/framebuffer";

// ---- helpers ----

let nextId = 1;
export function genId(): string {
  return `layer-${nextId++}`;
}

function cloneLayers(layers: Layer[]): Layer[] {
  return layers.map((l) => ({ ...l }));
}

// ---- state shape ----

export interface EditorState {
  layers: Layer[];
  selectedId: string | null;
  activeTool: Tool;
  allowedTools: Tool[] | null; // null = all tools allowed

  // undo / redo
  history: Layer[][];
  historyIndex: number;

  // mutations
  addLayer: (layer: Layer) => void;
  updateLayer: (id: string, patch: Partial<Layer>) => void;
  removeLayer: (id: string) => void;
  reorderLayer: (id: string, newZ: number) => void;
  selectLayer: (id: string | null) => void;
  setTool: (tool: Tool) => void;
  toggleVisibility: (id: string) => void;

  // history
  commitHistory: () => void;
  undo: () => void;
  redo: () => void;

  // init
  init: (allowedElements: AllowedElement[] | null) => void;
}

const TOOL_TO_ELEMENT: Record<Tool, AllowedElement | null> = {
  select: null,
  background: "background",
  image: "image_upload",
  text: "text",
  rect: "rect",
  line: "line",
  circle: "circle",
  icon: "icon",
};

const ALL_TOOLS: Tool[] = [
  "select",
  "background",
  "image",
  "text",
  "rect",
  "line",
  "circle",
  "icon",
];

function computeAllowedTools(
  allowedElements: AllowedElement[] | null,
): Tool[] | null {
  if (!allowedElements) return null;
  return ALL_TOOLS.filter((t) => {
    const el = TOOL_TO_ELEMENT[t];
    return el === null || allowedElements.includes(el);
  });
}

export const useEditorStore = create<EditorState>((set, get) => ({
  layers: [],
  selectedId: null,
  activeTool: "select",
  allowedTools: null,

  history: [[]],
  historyIndex: 0,

  addLayer: (layer: Layer) => {
    const state = get();
    const layers = [...state.layers, layer];
    set({ layers, selectedId: layer.id });
  },

  updateLayer: (id: string, patch: Partial<Layer>) => {
    set((s) => ({
      layers: s.layers.map((l) =>
        l.id === id ? ({ ...l, ...patch } as Layer) : l,
      ),
    }));
  },

  removeLayer: (id: string) => {
    set((s) => ({
      layers: s.layers.filter((l) => l.id !== id),
      selectedId: s.selectedId === id ? null : s.selectedId,
    }));
  },

  reorderLayer: (id: string, newZ: number) => {
    set((s) => {
      const layers = s.layers.map((l) =>
        l.id === id ? ({ ...l, z: newZ } as Layer) : l,
      );
      // Normalize z values to avoid gaps
      const sorted = [...layers].sort((a, b) => a.z - b.z);
      return {
        layers: sorted.map((l, i) => ({ ...l, z: i } as Layer)),
      };
    });
  },

  selectLayer: (id: string | null) => {
    set({ selectedId: id, activeTool: "select" });
  },

  setTool: (tool: Tool) => {
    set({ activeTool: tool });
  },

  toggleVisibility: (id: string) => {
    set((s) => ({
      layers: s.layers.map((l) =>
        l.id === id ? ({ ...l, visible: !l.visible } as Layer) : l,
      ),
    }));
  },

  commitHistory: () => {
    const state = get();
    const snapshot = cloneLayers(state.layers);
    const newHistory = state.history.slice(0, state.historyIndex + 1);
    newHistory.push(snapshot);
    // cap at 50 snapshots
    if (newHistory.length > 50) newHistory.shift();
    set({ history: newHistory, historyIndex: newHistory.length - 1 });
  },

  undo: () => {
    const state = get();
    if (state.historyIndex <= 0) return;
    const newIndex = state.historyIndex - 1;
    set({
      layers: cloneLayers(state.history[newIndex]),
      historyIndex: newIndex,
      selectedId: null,
    });
  },

  redo: () => {
    const state = get();
    if (state.historyIndex >= state.history.length - 1) return;
    const newIndex = state.historyIndex + 1;
    set({
      layers: cloneLayers(state.history[newIndex]),
      historyIndex: newIndex,
      selectedId: null,
    });
  },

  init: (allowedElements: AllowedElement[] | null) => {
    const allowedTools = computeAllowedTools(allowedElements);
    nextId = 1;
    set({
      layers: [],
      selectedId: null,
      activeTool: "select",
      allowedTools,
      history: [[]],
      historyIndex: 0,
    });
  },
}));
