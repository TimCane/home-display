/**
 * Minimal mobile editor state: image + optional text overlay.
 */

export interface TextOverlayState {
  text: string;
  fontSize: number;
  colorIndex: number; // palette index 0-3
}

export interface MobileEditorState {
  /** Object URL for the user-selected image, null if none */
  imageSrc: string | null;
  /** Natural dimensions of the loaded image */
  imageNaturalWidth: number;
  imageNaturalHeight: number;
  /** Optional single text overlay */
  textOverlay: TextOverlayState | null;
}

export const INITIAL_STATE: MobileEditorState = {
  imageSrc: null,
  imageNaturalWidth: 0,
  imageNaturalHeight: 0,
  textOverlay: null,
};

export const INITIAL_TEXT: TextOverlayState = {
  text: "",
  fontSize: 48,
  colorIndex: 1, // white by default
};

/** Max file size: 20 MB */
export const MAX_FILE_SIZE = 20 * 1024 * 1024;

/** Accepted image MIME types */
export const ACCEPTED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
];
