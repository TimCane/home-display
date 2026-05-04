import { useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { trpc } from "../trpc";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { FramebufferImage } from "../components/FramebufferImage";
import { ConditionsEditor } from "../components/ConditionsEditor";
import {
  Monitor,
  Lock,
  Trash2,
  Pencil,
  X,
  Check,
  Plus,
} from "lucide-react";
import type { Condition } from "../../shared/conditions";
import { useLayoutContext } from "../layout/Layout";

interface EntryRow {
  id: string;
  source: string;
  title: string;
  submitterName: string | null;
  enabled: boolean;
  baseWeight: number;
  conditions: unknown;
  lastShownAt: Date | null;
  showCount: number;
  createdAt: Date;
  updatedAt: Date;
}

function conditionsSummary(conditions: unknown): string {
  const arr = conditions as Condition[] | null;
  if (!arr || arr.length === 0) return "Always";
  return arr.map((c) => c.type.replace(/_/g, " ")).join(", ");
}

function sourceBadge(source: string) {
  const colors: Record<string, string> = {
    admin: "bg-blue-100 text-blue-800",
    guest: "bg-purple-100 text-purple-800",
    generator: "bg-amber-100 text-amber-800",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colors[source] ?? "bg-gray-100 text-gray-800"}`}
    >
      {source}
    </span>
  );
}

export function EntriesPage() {
  const { openCreateModal } = useLayoutContext();
  const entries = trpc.entry.list.useQuery();
  const utils = trpc.useUtils();
  const [editingId, setEditingId] = useState<string | null>(null);

  const updateMut = trpc.entry.update.useMutation({
    onSuccess: () => {
      utils.entry.list.invalidate();
      setEditingId(null);
    },
  });
  const deleteMut = trpc.entry.delete.useMutation({
    onSuccess: () => utils.entry.list.invalidate(),
  });
  const displayNowMut = trpc.entry.displayNow.useMutation();
  const lockMut = trpc.system.lock.useMutation();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Entries</h1>
        <Button onClick={openCreateModal}>
          <Plus className="mr-2 h-4 w-4" />
          New entry
        </Button>
      </div>
      {entries.isLoading && <p className="text-muted-foreground">Loading...</p>}
      {entries.data && entries.data.length === 0 && (
        <p className="text-muted-foreground">No entries yet.</p>
      )}
      {entries.data && entries.data.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 pr-4 font-medium">Preview</th>
                <th className="pb-2 pr-4 font-medium">Title</th>
                <th className="pb-2 pr-4 font-medium">Source</th>
                <th className="pb-2 pr-4 font-medium">Enabled</th>
                <th className="pb-2 pr-4 font-medium">Weight</th>
                <th className="pb-2 pr-4 font-medium">Conditions</th>
                <th className="pb-2 pr-4 font-medium">Shown</th>
                <th className="pb-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {entries.data.map((entry) => (
                <EntryTableRow
                  key={entry.id}
                  entry={entry as EntryRow}
                  isEditing={editingId === entry.id}
                  onEdit={() => setEditingId(entry.id)}
                  onCancelEdit={() => setEditingId(null)}
                  onSave={(patch) =>
                    updateMut.mutate({ id: entry.id, ...patch })
                  }
                  onDelete={() => {
                    if (confirm("Delete this entry?"))
                      deleteMut.mutate({ id: entry.id });
                  }}
                  onDisplayNow={() => displayNowMut.mutate({ id: entry.id })}
                  onLock={() => lockMut.mutate({ entryId: entry.id })}
                  isSaving={updateMut.isPending}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit Modal */}
      {editingId && entries.data && (
        <EditEntryModal
          entry={entries.data.find((e) => e.id === editingId) as EntryRow}
          onClose={() => setEditingId(null)}
          onSave={(patch) => updateMut.mutate({ id: editingId, ...patch })}
          isSaving={updateMut.isPending}
        />
      )}
    </div>
  );
}

function ThumbnailWithPopover({
  entryId,
  updatedAt,
}: {
  entryId: string;
  updatedAt: Date;
}) {
  const thumbRef = useRef<HTMLDivElement>(null);
  const [popover, setPopover] = useState<{ top: number; left: number } | null>(
    null,
  );
  const hideTimeout = useRef<ReturnType<typeof setTimeout>>();

  const show = useCallback(() => {
    clearTimeout(hideTimeout.current);
    const el = thumbRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const popoverW = 480;
    const popoverH = popoverW * 0.75; // approximate aspect ratio
    let left = rect.right + 8;
    let top = rect.top;
    // Keep within viewport
    if (left + popoverW > window.innerWidth - 8) {
      left = rect.left - popoverW - 8;
    }
    if (top + popoverH > window.innerHeight - 8) {
      top = window.innerHeight - popoverH - 8;
    }
    if (top < 8) top = 8;
    setPopover({ top, left });
  }, []);

  const hide = useCallback(() => {
    hideTimeout.current = setTimeout(() => setPopover(null), 100);
  }, []);

  const keepOpen = useCallback(() => {
    clearTimeout(hideTimeout.current);
  }, []);

  return (
    <>
      <div
        ref={thumbRef}
        onMouseEnter={show}
        onMouseLeave={hide}
        className="inline-block"
      >
        <FramebufferImage
          entryId={entryId}
          updatedAt={updatedAt}
          className="w-[120px] rounded cursor-zoom-in"
        />
      </div>
      {popover &&
        createPortal(
          <div
            onMouseEnter={keepOpen}
            onMouseLeave={hide}
            className="fixed z-[100] rounded-lg border bg-popover shadow-xl p-1"
            style={{ top: popover.top, left: popover.left }}
          >
            <FramebufferImage
              entryId={entryId}
              updatedAt={updatedAt}
              className="w-[480px] rounded"
            />
          </div>,
          document.body,
        )}
    </>
  );
}

function EntryTableRow({
  entry,
  isEditing,
  onEdit,
  onDelete,
  onDisplayNow,
  onLock,
}: {
  entry: EntryRow;
  isEditing: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSave: (patch: {
    title?: string;
    enabled?: boolean;
    baseWeight?: number;
    conditions?: Condition[];
  }) => void;
  onDelete: () => void;
  onDisplayNow: () => void;
  onLock: () => void;
  isSaving: boolean;
}) {
  const isGenerator = entry.source === "generator";

  return (
    <tr className="border-b">
      <td className="py-2 pr-4">
        <ThumbnailWithPopover entryId={entry.id} updatedAt={entry.updatedAt} />
      </td>
      <td className="py-2 pr-4 font-medium">{entry.title}</td>
      <td className="py-2 pr-4">{sourceBadge(entry.source)}</td>
      <td className="py-2 pr-4">
        <span
          className={`inline-block h-2 w-2 rounded-full ${entry.enabled ? "bg-green-500" : "bg-gray-300"}`}
        />
      </td>
      <td className="py-2 pr-4">{entry.baseWeight}</td>
      <td className="py-2 pr-4 text-xs text-muted-foreground max-w-[200px] truncate">
        {conditionsSummary(entry.conditions)}
      </td>
      <td className="py-2 pr-4">{entry.showCount}</td>
      <td className="py-2">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={onEdit} title="Edit">
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onDisplayNow}
            title="Display now"
          >
            <Monitor className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onLock}
            title="Lock to this"
          >
            <Lock className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onDelete}
            disabled={isGenerator}
            title={
              isGenerator
                ? "Delete the generator instance instead"
                : "Delete entry"
            }
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

function EditEntryModal({
  entry,
  onClose,
  onSave,
  isSaving,
}: {
  entry: EntryRow;
  onClose: () => void;
  onSave: (patch: {
    title?: string;
    enabled?: boolean;
    baseWeight?: number;
    conditions?: Condition[];
  }) => void;
  isSaving: boolean;
}) {
  const [title, setTitle] = useState(entry.title);
  const [enabled, setEnabled] = useState(entry.enabled);
  const [weight, setWeight] = useState(entry.baseWeight);
  const [conditions, setConditions] = useState<Condition[]>(
    (entry.conditions as Condition[]) ?? [],
  );
  const isGenerator = entry.source === "generator";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Edit Entry</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isGenerator}
              className="mt-1 w-full rounded border bg-background px-3 py-2 text-sm disabled:opacity-50"
            />
            {isGenerator && (
              <p className="mt-1 text-xs text-muted-foreground">
                Title is managed by the generator instance.
              </p>
            )}
          </div>

          <div className="flex items-center gap-4">
            <label htmlFor="entry-detail-enabled" className="flex items-center gap-2 text-sm">
              <input
                id="entry-detail-enabled"
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
                value={weight}
                onChange={(e) => setWeight(Number(e.target.value))}
                className="w-20 rounded border bg-background px-2 py-1 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Conditions</label>
            <div className="mt-2">
              <ConditionsEditor value={conditions} onChange={setConditions} />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                onSave({
                  title: isGenerator ? undefined : title,
                  enabled,
                  baseWeight: weight,
                  conditions,
                })
              }
              disabled={isSaving}
            >
              <Check className="mr-2 h-4 w-4" />
              Save
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
