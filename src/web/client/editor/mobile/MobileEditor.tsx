import { useState, useCallback } from "react";
import type { EditorVariantProps } from "../EditorShell";
import type { AllowedElement } from "../desktop/state/types";
import { INITIAL_STATE, INITIAL_TEXT, type MobileEditorState } from "./state";
import { ImagePicker } from "./ImagePicker";
import { TextOverlay } from "./TextOverlay";
import { Preview } from "./Preview";

/**
 * Reduced-surface editor for narrow viewports.
 * Pick an image, optional single text overlay, dithered preview, submit.
 */
export function MobileEditor({ draft, onFrameReady }: EditorVariantProps) {
  const [state, setState] = useState<MobileEditorState>(INITIAL_STATE);

  // Determine which elements are allowed
  const allowed = draft.guestMode
    ? (draft.allowedElements as AllowedElement[] | null)
    : null;
  const textAllowed = !allowed || allowed.includes("text");

  const handleImageSelected = useCallback(
    (src: string, naturalWidth: number, naturalHeight: number) => {
      // Revoke previous object URL to avoid leaks
      setState((prev) => {
        if (prev.imageSrc) URL.revokeObjectURL(prev.imageSrc);
        return {
          ...prev,
          imageSrc: src,
          imageNaturalWidth: naturalWidth,
          imageNaturalHeight: naturalHeight,
        };
      });
    },
    [],
  );

  const handleTextToggle = useCallback(() => {
    setState((prev) => ({
      ...prev,
      textOverlay: prev.textOverlay ? null : { ...INITIAL_TEXT },
    }));
  }, []);

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
      {/* Image picker */}
      <ImagePicker
        imageSrc={state.imageSrc}
        onImageSelected={handleImageSelected}
      />

      {/* Text overlay (optional) */}
      {textAllowed && state.imageSrc && (
        <div className="flex flex-col gap-2">
          {state.textOverlay ? (
            <>
              <TextOverlay
                value={state.textOverlay}
                onChange={(textOverlay) =>
                  setState((prev) => ({ ...prev, textOverlay }))
                }
              />
              <button
                onClick={handleTextToggle}
                className="text-xs text-muted-foreground underline self-end"
              >
                Remove text
              </button>
            </>
          ) : (
            <button
              onClick={handleTextToggle}
              className="rounded border border-dashed border-muted-foreground/30 py-2 text-sm text-muted-foreground"
            >
              + Add text overlay
            </button>
          )}
        </div>
      )}

      {/* Dithered preview */}
      <Preview state={state} onFrameReady={onFrameReady} />
    </div>
  );
}
