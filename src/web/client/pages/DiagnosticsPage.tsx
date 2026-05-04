import { useMemo, useState } from "react";
import { trpc } from "../trpc";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { useSystemState } from "../hooks/useSystemState";
import type { Condition } from "../../shared/conditions";
import { Zap } from "lucide-react";

function formatDate(d: Date | string): string {
  return new Date(d).toLocaleString();
}

export function DiagnosticsPage() {
  const system = useSystemState();
  const entries = trpc.entry.list.useQuery();
  const pushes = trpc.diagnostics.recentPushes.useQuery({ limit: 25 });
  const statusHistory = trpc.diagnostics.statusHistory.useQuery({ limit: 25 });
  const latestStatus = trpc.diagnostics.latestStatus.useQuery();
  const instances = trpc.generator.listInstances.useQuery();

  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(
    null,
  );
  const generatorRuns = trpc.diagnostics.generatorRuns.useQuery(
    {
      instanceId: selectedInstanceId ?? undefined,
      limit: 25,
    },
    { enabled: !!selectedInstanceId },
  );

  const setFlagMut = trpc.system.setFlag.useMutation({
    onSuccess: () => system.refetch(),
  });
  const testPatternMut = trpc.system.pushTestPattern.useMutation();

  // Discover flags
  const flagNames = useMemo(() => {
    if (!entries.data) return [];
    const names = new Set<string>();
    for (const entry of entries.data) {
      const conditions = entry.conditions as Condition[] | null;
      if (!conditions) continue;
      for (const c of conditions) {
        if (c.type === "manual_flag") names.add(c.params.flag);
      }
    }
    return [...names].sort();
  }, [entries.data]);

  const flags = (system.data?.flags ?? {}) as Record<string, boolean>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Diagnostics</h1>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Latest status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Latest Display Status</CardTitle>
          </CardHeader>
          <CardContent>
            {latestStatus.isLoading && (
              <p className="text-sm text-muted-foreground">Loading...</p>
            )}
            {latestStatus.data && (
              <pre className="text-xs bg-muted rounded p-3 overflow-auto max-h-48">
                {JSON.stringify(latestStatus.data, null, 2)}
              </pre>
            )}
            {latestStatus.data === null && (
              <p className="text-sm text-muted-foreground">
                No status recorded yet.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Controls */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              variant="outline"
              onClick={() => testPatternMut.mutate()}
              disabled={testPatternMut.isPending}
            >
              <Zap className="mr-2 h-4 w-4" />
              Push Test Pattern
            </Button>
            {testPatternMut.isSuccess && (
              <p className="text-xs text-green-600">Test pattern pushed!</p>
            )}
            {testPatternMut.error && (
              <p className="text-xs text-red-600">
                {testPatternMut.error.message}
              </p>
            )}

            {/* Flag toggles */}
            {flagNames.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Manual Flags</p>
                {flagNames.map((name) => (
                  <label
                    key={name}
                    htmlFor={`diag-flag-${name}`}
                    className="flex items-center justify-between text-sm"
                  >
                    <span>{name}</span>
                    <input
                      id={`diag-flag-${name}`}
                      type="checkbox"
                      checked={flags[name] ?? false}
                      onChange={(e) =>
                        setFlagMut.mutate({
                          name,
                          value: e.target.checked,
                        })
                      }
                      className="h-4 w-4 rounded border-input"
                    />
                  </label>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Push log */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Pushes</CardTitle>
        </CardHeader>
        <CardContent>
          {pushes.isLoading && (
            <p className="text-sm text-muted-foreground">Loading...</p>
          )}
          {pushes.data && pushes.data.length === 0 && (
            <p className="text-sm text-muted-foreground">No push records.</p>
          )}
          {pushes.data && pushes.data.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-1 pr-3 font-medium">Time</th>
                    <th className="pb-1 pr-3 font-medium">OK</th>
                    <th className="pb-1 pr-3 font-medium">Trigger</th>
                    <th className="pb-1 pr-3 font-medium">Status</th>
                    <th className="pb-1 font-medium">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {pushes.data.map((p) => (
                    <tr key={p.id} className="border-b">
                      <td className="py-1 pr-3">
                        {formatDate(p.attemptedAt)}
                      </td>
                      <td className="py-1 pr-3">
                        <span
                          className={`inline-block h-2 w-2 rounded-full ${p.succeeded ? "bg-green-500" : "bg-red-500"}`}
                        />
                      </td>
                      <td className="py-1 pr-3">{p.trigger}</td>
                      <td className="py-1 pr-3">
                        {p.firmwareStatus ?? "—"}
                      </td>
                      <td className="py-1 text-red-600 truncate max-w-[200px]">
                        {p.error ?? ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Display status history */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Display Status History</CardTitle>
        </CardHeader>
        <CardContent>
          {statusHistory.isLoading && (
            <p className="text-sm text-muted-foreground">Loading...</p>
          )}
          {statusHistory.data && statusHistory.data.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No status history recorded.
            </p>
          )}
          {statusHistory.data && statusHistory.data.length > 0 && (
            <>
              {/* Mini uptime sparkline */}
              <div className="flex gap-0.5 mb-3">
                {[...statusHistory.data].reverse().map((h) => (
                  <div
                    key={h.id}
                    className={`h-4 flex-1 rounded-sm ${h.reachable ? "bg-green-400" : "bg-red-400"}`}
                    title={`${formatDate(h.polledAt)}: ${h.reachable ? "reachable" : "unreachable"}`}
                  />
                ))}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-1 pr-3 font-medium">Polled At</th>
                      <th className="pb-1 font-medium">Reachable</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statusHistory.data.map((h) => (
                      <tr key={h.id} className="border-b">
                        <td className="py-1 pr-3">
                          {formatDate(h.polledAt)}
                        </td>
                        <td className="py-1">
                          <span
                            className={`inline-block h-2 w-2 rounded-full ${h.reachable ? "bg-green-500" : "bg-red-500"}`}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Generator runs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Generator Runs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {instances.data && instances.data.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {instances.data.map((inst) => (
                <button
                  key={inst.id}
                  onClick={() => setSelectedInstanceId(inst.id)}
                  className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                    selectedInstanceId === inst.id
                      ? "bg-primary text-primary-foreground"
                      : "bg-background text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {inst.instanceName}
                </button>
              ))}
            </div>
          )}
          {!selectedInstanceId && (
            <p className="text-sm text-muted-foreground">
              Select an instance to view run history.
            </p>
          )}
          {selectedInstanceId && generatorRuns.isLoading && (
            <p className="text-sm text-muted-foreground">Loading...</p>
          )}
          {selectedInstanceId &&
            generatorRuns.data &&
            generatorRuns.data.length === 0 && (
              <p className="text-sm text-muted-foreground">No runs recorded.</p>
            )}
          {generatorRuns.data && generatorRuns.data.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-1 pr-3 font-medium">Time</th>
                    <th className="pb-1 pr-3 font-medium">OK</th>
                    <th className="pb-1 font-medium">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {generatorRuns.data.map((r) => (
                    <tr key={r.id} className="border-b">
                      <td className="py-1 pr-3">{formatDate(r.ranAt)}</td>
                      <td className="py-1 pr-3">
                        <span
                          className={`inline-block h-2 w-2 rounded-full ${r.succeeded ? "bg-green-500" : "bg-red-500"}`}
                        />
                      </td>
                      <td className="py-1 text-red-600 truncate max-w-[200px]">
                        {r.error ?? ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
