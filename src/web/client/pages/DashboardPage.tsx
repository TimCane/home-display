import { trpc } from "../trpc";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card";

export function DashboardPage() {
  const entries = trpc.entry.list.useQuery();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Entries</CardTitle>
          </CardHeader>
          <CardContent>
            {entries.isLoading && (
              <p className="text-sm text-muted-foreground">Loading...</p>
            )}
            {entries.data && (
              <p className="text-2xl font-bold">{entries.data.length}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Display Status</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Placeholder — live status coming soon.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
