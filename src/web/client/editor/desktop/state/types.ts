/**
 * Layer model — discriminated union of all layer types.
 * Each layer has a shared base (id, type, position, rotation, z, visible)
 * plus type-specific props.
 */

export interface LayerBase {
  id: string;
  z: number;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number; // degrees
  visible: boolean;
}

export interface BackgroundLayer extends LayerBase {
  type: "background";
  colorIndex: number; // palette index 0-3
}

export interface ImageLayer extends LayerBase {
  type: "image";
  /** Data URL or object URL for the loaded image */
  src: string;
  naturalWidth: number;
  naturalHeight: number;
}

export interface TextLayer extends LayerBase {
  type: "text";
  text: string;
  fontFamily: string;
  fontSize: number;
  colorIndex: number; // palette index 0-3
}

export interface RectLayer extends LayerBase {
  type: "rect";
  colorIndex: number;
  filled: boolean;
  strokeWidth: number;
}

export interface LineLayer extends LayerBase {
  type: "line";
  colorIndex: number;
  strokeWidth: number;
}

export interface CircleLayer extends LayerBase {
  type: "circle";
  colorIndex: number;
  filled: boolean;
  strokeWidth: number;
}

export interface IconLayer extends LayerBase {
  type: "icon";
  iconName: string;
  colorIndex: number;
}

export type Layer =
  | BackgroundLayer
  | ImageLayer
  | TextLayer
  | RectLayer
  | LineLayer
  | CircleLayer
  | IconLayer;

export type LayerType = Layer["type"];

export type Tool =
  | "select"
  | "background"
  | "image"
  | "text"
  | "rect"
  | "line"
  | "circle"
  | "icon";

/** Which element types a guest is allowed to use */
export type AllowedElement =
  | "image_upload"
  | "text"
  | "rect"
  | "line"
  | "circle"
  | "icon"
  | "background";
