import { trpc } from "../trpc";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card";

export function DraftsPage() {
  const drafts = trpc.draft.list.useQuery({});

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Drafts</h1>
      {drafts.isLoading && <p className="text-muted-foreground">Loading...</p>}
      {drafts.data && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {drafts.data.map((draft) => (
            <Card key={draft.id}>
              <CardHeader>
                <CardTitle className="text-base">
                  {draft.guestMode ? "Guest" : "Admin"} draft
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  {draft.submitterName ?? "—"}
                </p>
              </CardContent>
            </Card>
          ))}
          {drafts.data.length === 0 && (
            <p className="text-muted-foreground">No active drafts.</p>
          )}
        </div>
      )}
    </div>
  );
}
