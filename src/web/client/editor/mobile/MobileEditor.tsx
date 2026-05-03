import type { EditorVariantProps } from "../EditorShell";

export function MobileEditor({ draft, onFrameReady }: EditorVariantProps) {
  return (
    <div className="flex flex-1 items-center justify-center border rounded bg-muted/30">
      <p className="text-sm text-muted-foreground">
        Mobile editor — coming in step 21.
      </p>
    </div>
  );
}
