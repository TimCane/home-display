import { trpc } from "../trpc";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card";

export function SettingsPage() {
  const settings = trpc.settings.getAll.useQuery();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>
      {settings.isLoading && (
        <p className="text-muted-foreground">Loading...</p>
      )}
      {settings.data && (
        <div className="space-y-4">
          {Object.entries(settings.data).map(([key, value]) => (
            <Card key={key}>
              <CardHeader>
                <CardTitle className="text-base">{key}</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-xs text-muted-foreground">
                  {JSON.stringify(value, null, 2)}
                </pre>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
