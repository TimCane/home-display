import { useMemo } from "react";
import { trpc } from "../trpc";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { FramebufferImage } from "../components/FramebufferImage";
import { useSystemState } from "../hooks/useSystemState";
import { Lock, Unlock } from "lucide-react";
import type { Condition } from "../../shared/conditions";

export function DashboardPage() {
  const system = useSystemState();
  const entries = trpc.entry.list.useQuery();
  const lockMut = trpc.system.lock.useMutation({
    onSuccess: () => system.refetch(),
  });
  const unlockMut = trpc.system.unlock.useMutation({
    onSuccess: () => system.refetch(),
  });
  const setFlagMut = trpc.system.setFlag.useMutation({
    onSuccess: () => system.refetch(),
  });

  // Discover all distinct manual_flag names referenced by entries
  const flagNames = useMemo(() => {
    if (!entries.data) return [];
    const names = new Set<string>();
    for (const entry of entries.data) {
      const conditions = entry.conditions as Condition[] | null;
      if (!conditions) continue;
      for (const c of conditions) {
        if (c.type === "manual_flag") {
          names.add(c.params.flag);
        }
      }
    }
    return [...names].sort();
  }, [entries.data]);

  const flags = (system.data?.flags ?? {}) as Record<string, boolean>;
  const isLocked = !!system.data?.lockEntryId;
  const currentEntryId = system.data?.currentlyDisplayedEntryId;
  const currentEntry = entries.data?.find((e) => e.id === currentEntryId);
  const isOnline = system.data?.displayOnline ?? false;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Current display */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Currently Displayed</span>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  isOnline
                    ? "bg-green-100 text-green-800"
                    : "bg-red-100 text-red-800"
                }`}
              >
                {isOnline ? "Online" : "Offline"}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {currentEntryId ? (
              <div className="space-y-2">
                <FramebufferImage
                  entryId={currentEntryId}
                  updatedAt={currentEntry?.updatedAt}
                  className="w-full max-w-[600px]"
                />
                {currentEntry && (
                  <p className="text-sm text-muted-foreground">
                    {currentEntry.title}
                    {currentEntry.showCount > 0 &&
                      ` — shown ${currentEntry.showCount} time${currentEntry.showCount !== 1 ? "s" : ""}`}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nothing displayed yet.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Controls sidebar */}
        <div className="space-y-4">
          {/* Lock controls */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Display Lock</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {isLocked ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    Locked to current entry
                  </p>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => unlockMut.mutate()}
                    disabled={unlockMut.isPending}
                  >
                    <Unlock className="mr-2 h-4 w-4" />
                    Unlock
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Scheduler is running normally
                  </p>
                  {currentEntryId && (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() =>
                        lockMut.mutate({ entryId: currentEntryId })
                      }
                      disabled={lockMut.isPending}
                    >
                      <Lock className="mr-2 h-4 w-4" />
                      Lock to Current
                    </Button>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Flag toggles */}
          {flagNames.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Flags</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {flagNames.map((name) => (
                  <label
                    key={name}
                    className="flex items-center justify-between text-sm"
                  >
                    <span>{name}</span>
                    <input
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
              </CardContent>
            </Card>
          )}

          {/* Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Library</CardTitle>
            </CardHeader>
            <CardContent>
              {entries.isLoading ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : (
                <div className="space-y-1 text-sm">
                  <p>
                    <span className="font-medium">
                      {entries.data?.length ?? 0}
                    </span>{" "}
                    entries
                  </p>
                  <p>
                    <span className="font-medium">
                      {entries.data?.filter((e) => e.enabled).length ?? 0}
                    </span>{" "}
                    enabled
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
