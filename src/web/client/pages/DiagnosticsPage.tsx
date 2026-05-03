import { trpc } from "../trpc";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card";

export function DiagnosticsPage() {
  const pushes = trpc.diagnostics.recentPushes.useQuery({ limit: 10 });
  const status = trpc.diagnostics.latestStatus.useQuery();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Diagnostics</h1>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Latest Display Status</CardTitle>
          </CardHeader>
          <CardContent>
            {status.isLoading && (
              <p className="text-sm text-muted-foreground">Loading...</p>
            )}
            {status.data && (
              <pre className="text-xs text-muted-foreground">
                {JSON.stringify(status.data, null, 2)}
              </pre>
            )}
            {status.data === null && (
              <p className="text-sm text-muted-foreground">
                No status recorded yet.
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recent Pushes</CardTitle>
          </CardHeader>
          <CardContent>
            {pushes.isLoading && (
              <p className="text-sm text-muted-foreground">Loading...</p>
            )}
            {pushes.data && (
              <p className="text-sm text-muted-foreground">
                {pushes.data.length} recent push(es)
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
