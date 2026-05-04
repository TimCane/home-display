import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { FRAME_BYTES } from "../../shared/framebuffer";
import { useViewport } from "./useViewport";
import { DesktopEditor } from "./desktop/DesktopEditor";
import { MobileEditor } from "./mobile/MobileEditor";

export interface DraftData {
  id: string;
  guestMode: boolean;
  submitterName: string | null;
  allowedElements: unknown;
  enabled: boolean;
  baseWeight: number;
  conditions: unknown;
}

export interface EditorVariantProps {
  draft: DraftData;
  onFrameReady: (getBytes: (() => Uint8Array) | null) => void;
}

interface EditorShellProps {
  draft: DraftData;
}

export function EditorShell({ draft }: EditorShellProps) {
  const navigate = useNavigate();
  const viewport = useViewport();
  const [title, setTitle] = useState("");
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const getFrameBytesRef = useRef<(() => Uint8Array) | null>(null);
  const [hasFrame, setHasFrame] = useState(false);

  const handleFrameReady = useCallback(
    (getter: (() => Uint8Array) | null) => {
      getFrameBytesRef.current = getter;
      setHasFrame(getter !== null);
    },
    [],
  );

  // Warn before navigating away when the editor has unsaved changes
  const isDirty = title.trim().length > 0 || hasFrame;

  useEffect(() => {
    if (!isDirty || done) return;

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };

    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty, done]);

  const canCommit = title.trim().length > 0 && getFrameBytesRef.current !== null;

  const handleCommit = async () => {
    if (!getFrameBytesRef.current) return;

    setCommitting(true);
    setError(null);

    try {
      const frameBytes = getFrameBytesRef.current();
      if (frameBytes.length !== FRAME_BYTES) {
        throw new Error(
          `Frame must be ${FRAME_BYTES} bytes, got ${frameBytes.length}`,
        );
      }

      const res = await fetch(`/api/draft/${draft.id}/commit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/octet-stream",
          "X-Draft-Title": title.trim(),
        },
        credentials: "include",
        body: frameBytes.buffer.slice(
          frameBytes.byteOffset,
          frameBytes.byteOffset + frameBytes.byteLength,
        ) as ArrayBuffer,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(body.error ?? "Commit failed");
      }

      setDone(true);

      if (draft.guestMode) {
        // Guest stays on a "thanks" screen
      } else {
        navigate("/entries");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Commit failed");
    } finally {
      setCommitting(false);
    }
  };

  if (done && draft.guestMode) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Thanks!</h1>
          <p className="text-muted-foreground">
            Your entry has been submitted.
          </p>
        </div>
      </div>
    );
  }

  const Variant = viewport === "desktop" ? DesktopEditor : MobileEditor;

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header bar */}
      <header className="flex items-center gap-4 border-b px-4 py-2">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Entry title (required)"
          className="flex-1 rounded border bg-background px-3 py-2 text-sm"
        />
        <Button
          onClick={handleCommit}
          disabled={!canCommit || committing}
        >
          {committing ? "Submitting..." : "Submit"}
        </Button>
      </header>

      {error && (
        <div className="border-b bg-red-50 px-4 py-2 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Editor variant */}
      <Variant draft={draft} onFrameReady={handleFrameReady} />
    </div>
  );
}
