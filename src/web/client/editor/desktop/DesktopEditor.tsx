import type { EditorVariantProps } from "../EditorShell";

export function DesktopEditor({ draft, onFrameReady }: EditorVariantProps) {
  return (
    <div className="flex flex-1 items-center justify-center border rounded bg-muted/30">
      <p className="text-sm text-muted-foreground">
        Desktop canvas editor — coming in step 20.
      </p>
    </div>
  );
}
