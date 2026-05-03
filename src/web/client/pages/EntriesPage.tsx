import { trpc } from "../trpc";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card";

export function EntriesPage() {
  const entries = trpc.entry.list.useQuery();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Entries</h1>
      {entries.isLoading && <p className="text-muted-foreground">Loading...</p>}
      {entries.data && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {entries.data.map((entry) => (
            <Card key={entry.id}>
              <CardHeader>
                <CardTitle className="text-base">{entry.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Source: {entry.source} &middot;{" "}
                  {entry.enabled ? "Enabled" : "Disabled"}
                </p>
              </CardContent>
            </Card>
          ))}
          {entries.data.length === 0 && (
            <p className="text-muted-foreground">No entries yet.</p>
          )}
        </div>
      )}
    </div>
  );
}
