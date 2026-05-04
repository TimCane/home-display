import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { trpc } from "../trpc";
import { Card, CardHeader, CardTitle, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { QrCode } from "./QrCode";
import { ConditionsEditor } from "./ConditionsEditor";
import { X, Copy, Check, ChevronDown, ChevronRight } from "lucide-react";
import type { Condition } from "../../shared/conditions";

type AllowedElement = "image_upload" | "text" | "rect" | "line" | "circle" | "icon";

const ELEMENT_OPTIONS: readonly AllowedElement[] = [
  "image_upload",
  "text",
  "rect",
  "line",
  "circle",
  "icon",
] as const;

interface CreateEntryModalProps {
  open: boolean;
  onClose: () => void;
}

export function CreateEntryModal({ open, onClose }: CreateEntryModalProps) {
  const navigate = useNavigate();

  // Form state
  const [guestMode, setGuestMode] = useState(false);
  const [submitterName, setSubmitterName] = useState("");
  const [allowedElements, setAllowedElements] = useState<AllowedElement[]>([
    "image_upload",
  ]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [baseWeight, setBaseWeight] = useState(1);
  const [conditions, setConditions] = useState<Condition[]>([]);

  // Post-save guest state
  const [createdDraftId, setCreatedDraftId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const createMut = trpc.draft.create.useMutation({
    onSuccess: (data) => {
      if (guestMode) {
        setCreatedDraftId(data.id);
      } else {
        onClose();
        navigate(`/editor/${data.id}`);
      }
    },
  });

  const editorUrl = createdDraftId
    ? `${window.location.origin}/editor/${createdDraftId}`
    : "";

  const handleSave = () => {
    createMut.mutate({
      guestMode,
      submitterName: guestMode ? submitterName : undefined,
      allowedElements: guestMode ? allowedElements : undefined,
      enabled,
      baseWeight,
      conditions: conditions.length > 0 ? conditions : undefined,
    });
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(editorUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    // Reset state
    setGuestMode(false);
    setSubmitterName("");
    setAllowedElements(["image_upload"]);
    setShowAdvanced(false);
    setEnabled(true);
    setBaseWeight(1);
    setConditions([]);
    setCreatedDraftId(null);
    setCopied(false);
    onClose();
  };

  if (!open) return null;

  // Guest post-save: show URL + QR
  if (createdDraftId) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <Card className="w-full max-w-md">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Share with guest</CardTitle>
            <Button variant="ghost" size="icon" onClick={handleClose}>
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-center">
              <QrCode value={editorUrl} size={200} />
            </div>

            <div>
              <label className="text-sm font-medium">Editor URL</label>
              <div className="mt-1 flex gap-2">
                <code className="flex-1 break-all rounded border bg-muted px-3 py-2 text-xs">
                  {editorUrl}
                </code>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopy}
                  title="Copy URL"
                >
                  {copied ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Share this URL or scan the QR code to open the editor. The link
              expires in 24 hours and can only be used once.
            </p>

            <div className="flex justify-end">
              <Button variant="outline" onClick={handleClose}>
                Done
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Create entry</CardTitle>
          <Button variant="ghost" size="icon" onClick={handleClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Guest mode toggle */}
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={guestMode}
              onChange={(e) => setGuestMode(e.target.checked)}
              className="h-4 w-4 rounded border-input"
            />
            Guest entry
          </label>

          {/* Guest-mode fields */}
          {guestMode && (
            <div className="space-y-3 rounded border p-3">
              <div>
                <label className="text-sm font-medium">
                  Submitter name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={submitterName}
                  onChange={(e) => setSubmitterName(e.target.value)}
                  placeholder="Who is this for?"
                  className="mt-1 w-full rounded border bg-background px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="text-sm font-medium">Allowed elements</label>
                <div className="mt-1 flex flex-wrap gap-2">
                  {ELEMENT_OPTIONS.map((el) => {
                    const active = allowedElements.includes(el);
                    return (
                      <button
                        key={el}
                        onClick={() => {
                          if (active && allowedElements.length <= 1) return;
                          setAllowedElements(
                            active
                              ? allowedElements.filter((e) => e !== el)
                              : [...allowedElements, el],
                          );
                        }}
                        className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                          active
                            ? "bg-primary text-primary-foreground"
                            : "bg-background text-muted-foreground hover:bg-accent"
                        }`}
                      >
                        {el.replace(/_/g, " ")}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Advanced disclosure */}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            {showAdvanced ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            Advanced
          </button>

          {showAdvanced && (
            <div className="space-y-3 rounded border p-3">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => setEnabled(e.target.checked)}
                    className="h-4 w-4 rounded border-input"
                  />
                  Enabled
                </label>
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium">Weight</label>
                  <input
                    type="number"
                    min={1}
                    value={baseWeight}
                    onChange={(e) => setBaseWeight(Number(e.target.value))}
                    className="w-20 rounded border bg-background px-2 py-1 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Conditions</label>
                <div className="mt-2">
                  <ConditionsEditor
                    value={conditions}
                    onChange={setConditions}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {createMut.error && (
            <p className="text-sm text-red-500">{createMut.error.message}</p>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={
                createMut.isPending ||
                (guestMode && submitterName.trim().length === 0)
              }
            >
              {createMut.isPending ? "Creating..." : "Create"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
