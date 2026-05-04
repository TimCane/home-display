import { useState } from "react";
import { trpc } from "../trpc";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import {
  Play,
  Pencil,
  Trash2,
  Plus,
  Check,
  X,
  CheckCircle,
  XCircle,
} from "lucide-react";

export function GeneratorsPage() {
  const plugins = trpc.generator.listPlugins.useQuery();
  const instances = trpc.generator.listInstances.useQuery();
  const utils = trpc.useUtils();

  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const deleteMut = trpc.generator.deleteInstance.useMutation({
    onSuccess: () => {
      utils.generator.listInstances.invalidate();
      utils.entry.list.invalidate();
    },
  });
  const runNowMut = trpc.generator.runNow.useMutation({
    onSuccess: () => utils.generator.listInstances.invalidate(),
  });

  const pluginList = plugins.data ?? [];
  const selectedPlugin = activeTab ?? pluginList[0]?.name ?? null;

  const filteredInstances = (instances.data ?? []).filter(
    (i) => i.pluginName === selectedPlugin,
  );

  if (plugins.isLoading || instances.isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Generators</h1>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Generators</h1>

      {pluginList.length === 0 && (
        <p className="text-muted-foreground">No generator plugins registered.</p>
      )}

      {pluginList.length > 0 && (
        <>
          {/* Plugin tabs */}
          <div className="flex gap-2 border-b">
            {pluginList.map((p) => (
              <button
                key={p.name}
                onClick={() => {
                  setActiveTab(p.name);
                  setShowCreate(false);
                  setEditingId(null);
                }}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  selectedPlugin === p.name
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>

          {/* Instances table */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {filteredInstances.length} instance
              {filteredInstances.length !== 1 ? "s" : ""}
            </p>
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus className="mr-1 h-4 w-4" />
              New Instance
            </Button>
          </div>

          {filteredInstances.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2">
              {filteredInstances.map((inst) => (
                <Card key={inst.id}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between text-base">
                      <span>{inst.instanceName}</span>
                      <span className="text-xs font-normal text-muted-foreground">
                        {inst.renderer}
                      </span>
                    </CardTitle>
                    <CardDescription>
                      Cron: <code>{inst.cronExpr}</code>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Health info */}
                    {inst.lastRun && (
                      <div className="flex items-center gap-2 text-xs">
                        {inst.lastRun.succeeded ? (
                          <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5 text-red-600" />
                        )}
                        <span className="text-muted-foreground">
                          Last run:{" "}
                          {new Date(inst.lastRun.ranAt).toLocaleString()}
                        </span>
                        {inst.lastRun.error && (
                          <span className="text-red-600 truncate max-w-[200px]">
                            {inst.lastRun.error}
                          </span>
                        )}
                      </div>
                    )}
                    {!inst.lastRun && (
                      <p className="text-xs text-muted-foreground">
                        No runs yet
                      </p>
                    )}

                    {/* Actions */}
                    <div className="flex gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => runNowMut.mutate({ id: inst.id })}
                        disabled={runNowMut.isPending}
                      >
                        <Play className="mr-1 h-3 w-3" />
                        Run Now
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingId(inst.id)}
                      >
                        <Pencil className="mr-1 h-3 w-3" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (
                            confirm(
                              "Delete this instance and its entry?",
                            )
                          )
                            deleteMut.mutate({ id: inst.id });
                        }}
                      >
                        <Trash2 className="mr-1 h-3 w-3" />
                        Delete
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Create modal */}
          {showCreate && selectedPlugin && (
            <CreateInstanceModal
              pluginName={selectedPlugin}
              renderers={
                pluginList.find((p) => p.name === selectedPlugin)?.renderers ?? []
              }
              onClose={() => setShowCreate(false)}
            />
          )}

          {/* Edit modal */}
          {editingId && (
            <EditInstanceModal
              instance={instances.data!.find((i) => i.id === editingId)!}
              onClose={() => setEditingId(null)}
            />
          )}
        </>
      )}
    </div>
  );
}

function defaultConfigForPlugin(pluginName: string): Record<string, unknown> {
  switch (pluginName) {
    case "weather":
      return { location: { lat: 0, lon: 0, name: "" }, units: "metric" };
    case "calendar":
      return { ics_url: "", calendar_name: "" };
    default:
      return {};
  }
}

function WeatherConfigForm({
  config,
  onChange,
}: {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
}) {
  const location = (config.location ?? { lat: 0, lon: 0, name: "" }) as {
    lat: number;
    lon: number;
    name: string;
  };
  const units = (config.units ?? "metric") as string;

  const inputClass =
    "mt-1 w-full rounded border bg-background px-3 py-2 text-sm";

  return (
    <>
      <div>
        <label className="text-sm font-medium">Location Name</label>
        <input
          type="text"
          value={location.name}
          onChange={(e) =>
            onChange({
              ...config,
              location: { ...location, name: e.target.value },
            })
          }
          className={inputClass}
          placeholder="London"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium">Latitude</label>
          <input
            type="number"
            step="any"
            min={-90}
            max={90}
            value={location.lat}
            onChange={(e) =>
              onChange({
                ...config,
                location: { ...location, lat: parseFloat(e.target.value) || 0 },
              })
            }
            className={inputClass}
            placeholder="51.5074"
          />
        </div>
        <div>
          <label className="text-sm font-medium">Longitude</label>
          <input
            type="number"
            step="any"
            min={-180}
            max={180}
            value={location.lon}
            onChange={(e) =>
              onChange({
                ...config,
                location: { ...location, lon: parseFloat(e.target.value) || 0 },
              })
            }
            className={inputClass}
            placeholder="-0.1278"
          />
        </div>
      </div>
      <div>
        <label className="text-sm font-medium">Units</label>
        <select
          value={units}
          onChange={(e) => onChange({ ...config, units: e.target.value })}
          className={inputClass}
        >
          <option value="metric">Metric</option>
          <option value="imperial">Imperial</option>
        </select>
      </div>
    </>
  );
}

function CalendarConfigForm({
  config,
  onChange,
}: {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
}) {
  const inputClass =
    "mt-1 w-full rounded border bg-background px-3 py-2 text-sm";

  return (
    <>
      <div>
        <label className="text-sm font-medium">ICS URL</label>
        <input
          type="url"
          value={(config.ics_url as string) ?? ""}
          onChange={(e) => onChange({ ...config, ics_url: e.target.value })}
          className={inputClass}
          placeholder="https://example.com/calendar.ics"
        />
      </div>
      <div>
        <label className="text-sm font-medium">Calendar Name</label>
        <input
          type="text"
          value={(config.calendar_name as string) ?? ""}
          onChange={(e) =>
            onChange({ ...config, calendar_name: e.target.value })
          }
          className={inputClass}
          placeholder="Family Calendar"
        />
      </div>
    </>
  );
}

function PluginConfigFields({
  pluginName,
  config,
  onChange,
}: {
  pluginName: string;
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
}) {
  switch (pluginName) {
    case "weather":
      return <WeatherConfigForm config={config} onChange={onChange} />;
    case "calendar":
      return <CalendarConfigForm config={config} onChange={onChange} />;
    default:
      return (
        <div>
          <label className="text-sm font-medium">Config (JSON)</label>
          <textarea
            value={JSON.stringify(config, null, 2)}
            onChange={(e) => {
              try {
                onChange(JSON.parse(e.target.value));
              } catch {
                /* ignore parse errors while typing */
              }
            }}
            rows={4}
            className="mt-1 w-full rounded border bg-background px-3 py-2 text-sm font-mono"
          />
        </div>
      );
  }
}

function CreateInstanceModal({
  pluginName,
  renderers,
  onClose,
}: {
  pluginName: string;
  renderers: string[];
  onClose: () => void;
}) {
  const utils = trpc.useUtils();
  const [name, setName] = useState("");
  const [renderer, setRenderer] = useState(renderers[0] ?? "");
  const [cron, setCron] = useState("*/30 * * * *");
  const [config, setConfig] = useState<Record<string, unknown>>(
    defaultConfigForPlugin(pluginName),
  );

  const createMut = trpc.generator.createInstance.useMutation({
    onSuccess: () => {
      utils.generator.listInstances.invalidate();
      utils.entry.list.invalidate();
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>New {pluginName} Instance</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded border bg-background px-3 py-2 text-sm"
              placeholder="My Weather Widget"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Renderer</label>
            <select
              value={renderer}
              onChange={(e) => setRenderer(e.target.value)}
              className="mt-1 w-full rounded border bg-background px-3 py-2 text-sm"
            >
              {renderers.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">Cron Expression</label>
            <input
              type="text"
              value={cron}
              onChange={(e) => setCron(e.target.value)}
              className="mt-1 w-full rounded border bg-background px-3 py-2 text-sm font-mono"
            />
          </div>
          <PluginConfigFields
            pluginName={pluginName}
            config={config}
            onChange={setConfig}
          />
          {createMut.error && (
            <p className="text-sm text-red-600">
              {createMut.error.message}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                createMut.mutate({
                  plugin: pluginName,
                  renderer,
                  instanceName: name,
                  config,
                  cronExpr: cron,
                })
              }
              disabled={!name || !renderer || createMut.isPending}
            >
              <Check className="mr-2 h-4 w-4" />
              Create
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function EditInstanceModal({
  instance,
  onClose,
}: {
  instance: {
    id: string;
    pluginName: string;
    instanceName: string;
    renderer: string;
    cronExpr: string;
    config: unknown;
  };
  onClose: () => void;
}) {
  const utils = trpc.useUtils();
  const [name, setName] = useState(instance.instanceName);
  const [cron, setCron] = useState(instance.cronExpr);
  const [config, setConfig] = useState<Record<string, unknown>>(
    (instance.config as Record<string, unknown>) ?? {},
  );

  const updateMut = trpc.generator.updateInstance.useMutation({
    onSuccess: () => {
      utils.generator.listInstances.invalidate();
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Edit Instance</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Cron Expression</label>
            <input
              type="text"
              value={cron}
              onChange={(e) => setCron(e.target.value)}
              className="mt-1 w-full rounded border bg-background px-3 py-2 text-sm font-mono"
            />
          </div>
          <PluginConfigFields
            pluginName={instance.pluginName}
            config={config}
            onChange={setConfig}
          />
          {updateMut.error && (
            <p className="text-sm text-red-600">
              {updateMut.error.message}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                updateMut.mutate({
                  id: instance.id,
                  instanceName: name,
                  cronExpr: cron,
                  config,
                })
              }
              disabled={!name || updateMut.isPending}
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
