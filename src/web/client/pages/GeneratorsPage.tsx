import { trpc } from "../trpc";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card";

export function GeneratorsPage() {
  const instances = trpc.generator.listInstances.useQuery();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Generators</h1>
      {instances.isLoading && (
        <p className="text-muted-foreground">Loading...</p>
      )}
      {instances.data && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {instances.data.map((inst) => (
            <Card key={inst.id}>
              <CardHeader>
                <CardTitle className="text-base">
                  {inst.instanceName}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  {inst.pluginName}:{inst.renderer} &middot; {inst.cronExpr}
                </p>
              </CardContent>
            </Card>
          ))}
          {instances.data.length === 0 && (
            <p className="text-muted-foreground">No generator instances.</p>
          )}
        </div>
      )}
    </div>
  );
}
