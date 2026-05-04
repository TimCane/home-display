import { useState } from "react";
import { trpc } from "../trpc";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Copy, QrCode as QrCodeIcon, Ban } from "lucide-react";
import { QrCode } from "../components/QrCode";

const FILTERS = ["unconsumed", "consumed", "expired", "all"] as const;
type DraftFilter = (typeof FILTERS)[number];

function draftStatus(draft: {
  consumedAt: Date | null;
  expiresAt: Date;
}): string {
  if (draft.consumedAt) return "consumed";
  if (new Date(draft.expiresAt) < new Date()) return "expired";
  return "active";
}

function statusBadge(status: string) {
  const colors: Record<string, string> = {
    active: "bg-green-100 text-green-800",
    consumed: "bg-gray-100 text-gray-800",
    expired: "bg-red-100 text-red-800",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colors[status] ?? "bg-gray-100 text-gray-800"}`}
    >
      {status}
    </span>
  );
}

function formatDate(d: Date | string): string {
  return new Date(d).toLocaleString();
}

const PAGE_SIZE = 50;

export function DraftsPage() {
  const [filter, setFilter] = useState<DraftFilter>("unconsumed");
  const [page, setPage] = useState(0);
  const drafts = trpc.draft.list.useQuery({ filter, skip: page * PAGE_SIZE, take: PAGE_SIZE });
  const utils = trpc.useUtils();
  const revokeMut = trpc.draft.revoke.useMutation({
    onSuccess: () => utils.draft.list.invalidate(),
  });
  const [qrDraftId, setQrDraftId] = useState<string | null>(null);
  const totalPages = drafts.data ? Math.ceil(drafts.data.total / PAGE_SIZE) : 0;
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const editorUrl = (id: string) => `${window.location.origin}/editor/${id}`;

  const copyUrl = async (id: string) => {
    await navigator.clipboard.writeText(editorUrl(id));
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Drafts</h1>

      {/* Filter chips */}
      <div className="flex gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => { setFilter(f); setPage(0); }}
            className={`rounded-full px-3 py-1 text-sm font-medium border transition-colors ${
              filter === f
                ? "bg-primary text-primary-foreground"
                : "bg-background text-muted-foreground hover:bg-accent"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {drafts.isLoading && <p className="text-muted-foreground">Loading...</p>}

      {drafts.data && drafts.data.items.length === 0 && (
        <p className="text-muted-foreground">No drafts match this filter.</p>
      )}

      {drafts.data && drafts.data.items.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 pr-4 font-medium">Status</th>
                <th className="pb-2 pr-4 font-medium">Type</th>
                <th className="pb-2 pr-4 font-medium">Submitter</th>
                <th className="pb-2 pr-4 font-medium">Created</th>
                <th className="pb-2 pr-4 font-medium">Expires</th>
                <th className="pb-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {drafts.data.items.map((draft) => {
                const status = draftStatus(draft);
                const isActive = status === "active";
                return (
                  <tr key={draft.id} className="border-b">
                    <td className="py-2 pr-4">{statusBadge(status)}</td>
                    <td className="py-2 pr-4">
                      {draft.guestMode ? "Guest" : "Admin"}
                    </td>
                    <td className="py-2 pr-4">
                      {draft.submitterName ?? "—"}
                    </td>
                    <td className="py-2 pr-4 text-xs">
                      {formatDate(draft.createdAt)}
                    </td>
                    <td className="py-2 pr-4 text-xs">
                      {formatDate(draft.expiresAt)}
                    </td>
                    <td className="py-2">
                      <div className="flex items-center gap-1">
                        {isActive && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => copyUrl(draft.id)}
                              title="Copy editor URL"
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                setQrDraftId(
                                  qrDraftId === draft.id ? null : draft.id,
                                )
                              }
                              title="Show QR code"
                            >
                              <QrCodeIcon className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setRevokingId(draft.id)}
                              title="Revoke draft"
                            >
                              <Ban className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, drafts.data!.total)} of {drafts.data!.total}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* QR Code display */}
      {qrDraftId && (
        <Card>
          <CardContent className="pt-6 space-y-3">
            <div className="flex justify-center">
              <QrCode value={editorUrl(qrDraftId)} size={200} />
            </div>
            <div>
              <p className="mb-1 text-sm font-medium">Editor URL:</p>
              <code className="block break-all rounded bg-muted p-2 text-xs">
                {editorUrl(qrDraftId)}
              </code>
            </div>
            <p className="text-xs text-muted-foreground">
              Share this URL or scan the QR code to open the editor.
            </p>
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={revokingId !== null}
        title="Revoke draft"
        message="Are you sure you want to revoke this draft? The editor link will stop working."
        confirmLabel="Revoke"
        onConfirm={() => {
          if (revokingId) revokeMut.mutate({ id: revokingId });
          setRevokingId(null);
        }}
        onCancel={() => setRevokingId(null)}
      />
    </div>
  );
}
