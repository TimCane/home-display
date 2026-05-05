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
import { ConfirmDialog } from "../components/ConfirmDialog";
import {
  Play,
  Pencil,
  Trash2,
  Plus,
  Check,
  X,
  CheckCircle,
  XCircle,
  Settings,
} from "lucide-react";

export function GeneratorsPage() {
  const plugins = trpc.generator.listPlugins.useQuery();
  const instances = trpc.generator.listInstances.useQuery();
  const utils = trpc.useUtils();

  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showSharedConfig, setShowSharedConfig] = useState<string | null>(null);

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
            <div className="flex gap-2">
              {pluginList.find((p) => p.name === selectedPlugin)
                ?.hasSharedConfig && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowSharedConfig(selectedPlugin)}
                >
                  <Settings className="mr-1 h-4 w-4" />
                  Plugin Settings
                </Button>
              )}
              <Button size="sm" onClick={() => setShowCreate(true)}>
                <Plus className="mr-1 h-4 w-4" />
                New Instance
              </Button>
            </div>
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
                        onClick={() => setDeletingId(inst.id)}
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

          {/* Shared config modal */}
          {showSharedConfig && (
            <SharedConfigModal
              pluginName={showSharedConfig}
              onClose={() => setShowSharedConfig(null)}
            />
          )}

          <ConfirmDialog
            open={deletingId !== null}
            title="Delete instance"
            message="Are you sure you want to delete this instance and its entry? This action cannot be undone."
            confirmLabel="Delete"
            onConfirm={() => {
              if (deletingId) deleteMut.mutate({ id: deletingId });
              setDeletingId(null);
            }}
            onCancel={() => setDeletingId(null)}
          />
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
    case "holiday-weather":
      return {
        units: "metric",
        trips: [
          {
            name: "",
            location: { lat: 0, lon: 0, name: "" },
            startDate: "",
            endDate: "",
          },
        ],
      };
    case "quote":
      return {};
    case "word-of-the-day":
      return {};
    case "on-this-day":
      return { max_events: 3 };
    case "astronomy":
      return { location: { lat: 0, lon: 0, name: "" } };
    case "pollen-aqi":
      return { location: { lat: 0, lon: 0, name: "" } };
    case "bin-collection":
      return { source_type: "woking", council_name: "Woking Borough Council", house_number: "", postcode: "" };
    case "garmin":
      return { username: "", password: "" };
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

interface TripEntry {
  name: string;
  location: { lat: number; lon: number; name: string };
  startDate: string;
  endDate: string;
}

function HolidayWeatherConfigForm({
  config,
  onChange,
}: {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
}) {
  const trips = (config.trips ?? []) as TripEntry[];
  const units = (config.units ?? "metric") as string;

  const inputClass =
    "mt-1 w-full rounded border bg-background px-3 py-2 text-sm";

  const updateTrip = (index: number, patch: Partial<TripEntry>) => {
    const updated = trips.map((t, i) =>
      i === index ? { ...t, ...patch } : t,
    );
    onChange({ ...config, trips: updated });
  };

  const updateTripLocation = (
    index: number,
    locPatch: Partial<TripEntry["location"]>,
  ) => {
    const updated = trips.map((t, i) =>
      i === index
        ? { ...t, location: { ...t.location, ...locPatch } }
        : t,
    );
    onChange({ ...config, trips: updated });
  };

  const addTrip = () => {
    onChange({
      ...config,
      trips: [
        ...trips,
        {
          name: "",
          location: { lat: 0, lon: 0, name: "" },
          startDate: "",
          endDate: "",
        },
      ],
    });
  };

  const removeTrip = (index: number) => {
    onChange({
      ...config,
      trips: trips.filter((_, i) => i !== index),
    });
  };

  return (
    <>
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

      {trips.map((trip, i) => (
        <div
          key={i}
          className="rounded border p-3 space-y-2"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Trip {i + 1}</span>
            {trips.length > 1 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeTrip(i)}
                className="text-xs text-destructive"
              >
                Remove
              </Button>
            )}
          </div>

          <div>
            <label className="text-xs text-muted-foreground">Trip Name</label>
            <input
              type="text"
              value={trip.name}
              onChange={(e) => updateTrip(i, { name: e.target.value })}
              className={inputClass}
              placeholder="Kos Holiday"
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground">
              Location Name
            </label>
            <input
              type="text"
              value={trip.location.name}
              onChange={(e) =>
                updateTripLocation(i, { name: e.target.value })
              }
              className={inputClass}
              placeholder="Kos, Greece"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground">Latitude</label>
              <input
                type="number"
                step="any"
                min={-90}
                max={90}
                value={trip.location.lat}
                onChange={(e) =>
                  updateTripLocation(i, {
                    lat: parseFloat(e.target.value) || 0,
                  })
                }
                className={inputClass}
                placeholder="36.89"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Longitude</label>
              <input
                type="number"
                step="any"
                min={-180}
                max={180}
                value={trip.location.lon}
                onChange={(e) =>
                  updateTripLocation(i, {
                    lon: parseFloat(e.target.value) || 0,
                  })
                }
                className={inputClass}
                placeholder="27.09"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground">
                Start Date
              </label>
              <input
                type="date"
                value={trip.startDate}
                onChange={(e) =>
                  updateTrip(i, { startDate: e.target.value })
                }
                className={inputClass}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">End Date</label>
              <input
                type="date"
                value={trip.endDate}
                onChange={(e) =>
                  updateTrip(i, { endDate: e.target.value })
                }
                className={inputClass}
              />
            </div>
          </div>
        </div>
      ))}

      {trips.length < 8 && (
        <Button variant="outline" size="sm" onClick={addTrip}>
          + Add Trip
        </Button>
      )}
    </>
  );
}

function QuoteConfigForm() {
  return (
    <p className="text-sm text-muted-foreground">
      No configuration needed — a new quote is fetched daily.
    </p>
  );
}

function WordOfTheDayConfigForm() {
  return (
    <p className="text-sm text-muted-foreground">
      No configuration needed — a word is selected automatically each day.
    </p>
  );
}

function OnThisDayConfigForm({
  config,
  onChange,
}: {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
}) {
  const inputClass =
    "mt-1 w-full rounded border bg-background px-3 py-2 text-sm";

  return (
    <div>
      <label className="text-sm font-medium">Max Events</label>
      <input
        type="number"
        min={1}
        max={5}
        value={(config.max_events as number) ?? 3}
        onChange={(e) =>
          onChange({ ...config, max_events: parseInt(e.target.value) || 3 })
        }
        className={inputClass}
      />
      <p className="mt-1 text-xs text-muted-foreground">
        Number of historical events to show (1–5)
      </p>
    </div>
  );
}

function AstronomyConfigForm({
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
    </>
  );
}

function PollenAqiConfigForm({
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
    </>
  );
}

function BinCollectionConfigForm({
  config,
  onChange,
}: {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
}) {
  const sourceType = (config.source_type as string) ?? "ics";

  const inputClass =
    "mt-1 w-full rounded border bg-background px-3 py-2 text-sm";

  return (
    <>
      <div>
        <label className="text-sm font-medium">Council Name</label>
        <input
          type="text"
          value={(config.council_name as string) ?? ""}
          onChange={(e) => onChange({ ...config, council_name: e.target.value })}
          className={inputClass}
          placeholder="My Council"
        />
      </div>
      <div>
        <label className="text-sm font-medium">Source Type</label>
        <select
          value={sourceType}
          onChange={(e) => onChange({ ...config, source_type: e.target.value })}
          className={inputClass}
        >
          <option value="ics">ICS Feed</option>
          <option value="json">JSON API</option>
          <option value="woking">Woking Borough Council</option>
        </select>
      </div>
      {sourceType === "ics" && (
        <div>
          <label className="text-sm font-medium">ICS URL</label>
          <input
            type="url"
            value={(config.ics_url as string) ?? ""}
            onChange={(e) => onChange({ ...config, ics_url: e.target.value })}
            className={inputClass}
            placeholder="https://council.gov.uk/bins/calendar.ics"
          />
        </div>
      )}
      {sourceType === "json" && (
        <>
          <div>
            <label className="text-sm font-medium">API URL</label>
            <input
              type="url"
              value={(config.api_url as string) ?? ""}
              onChange={(e) => onChange({ ...config, api_url: e.target.value })}
              className={inputClass}
              placeholder="https://api.council.gov.uk/bins"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Address ID</label>
            <input
              type="text"
              value={(config.address_id as string) ?? ""}
              onChange={(e) =>
                onChange({ ...config, address_id: e.target.value })
              }
              className={inputClass}
              placeholder="Optional"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Address identifier for the API, if required
            </p>
          </div>
        </>
      )}
      {sourceType === "woking" && (
        <>
          <div>
            <label className="text-sm font-medium">House Number / Name</label>
            <input
              type="text"
              value={(config.house_number as string) ?? ""}
              onChange={(e) =>
                onChange({ ...config, house_number: e.target.value })
              }
              className={inputClass}
              placeholder="42"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Postcode</label>
            <input
              type="text"
              value={(config.postcode as string) ?? ""}
              onChange={(e) =>
                onChange({ ...config, postcode: e.target.value })
              }
              className={inputClass}
              placeholder="GU21 5AA"
            />
          </div>
        </>
      )}
    </>
  );
}

function GarminConfigForm() {
  return (
    <p className="text-sm text-muted-foreground">
      No per-instance configuration needed. Set your Garmin credentials via the
      &quot;Plugin Settings&quot; button above.
    </p>
  );
}

function GarminSharedConfigForm({
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
        <label className="text-sm font-medium">Username / Email</label>
        <input
          type="text"
          value={(config.username as string) ?? ""}
          onChange={(e) => onChange({ ...config, username: e.target.value })}
          className={inputClass}
          placeholder="your.email@example.com"
        />
      </div>
      <div>
        <label className="text-sm font-medium">Password</label>
        <input
          type="password"
          value={(config.password as string) ?? ""}
          onChange={(e) => onChange({ ...config, password: e.target.value })}
          className={inputClass}
          placeholder="Your Garmin Connect password"
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
    case "holiday-weather":
      return <HolidayWeatherConfigForm config={config} onChange={onChange} />;
    case "quote":
      return <QuoteConfigForm />;
    case "word-of-the-day":
      return <WordOfTheDayConfigForm />;
    case "on-this-day":
      return <OnThisDayConfigForm config={config} onChange={onChange} />;
    case "astronomy":
      return <AstronomyConfigForm config={config} onChange={onChange} />;
    case "pollen-aqi":
      return <PollenAqiConfigForm config={config} onChange={onChange} />;
    case "bin-collection":
      return <BinCollectionConfigForm config={config} onChange={onChange} />;
    case "garmin":
      return <GarminConfigForm />;
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

function SharedPluginConfigFields({
  pluginName,
  config,
  onChange,
}: {
  pluginName: string;
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
}) {
  switch (pluginName) {
    case "garmin":
      return <GarminSharedConfigForm config={config} onChange={onChange} />;
    default:
      return (
        <div>
          <label className="text-sm font-medium">Shared Config (JSON)</label>
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

function SharedConfigModal({
  pluginName,
  onClose,
}: {
  pluginName: string;
  onClose: () => void;
}) {
  const existing = trpc.generator.getSharedConfig.useQuery({ pluginName });
  const [config, setConfig] = useState<Record<string, unknown>>({});
  const [initialized, setInitialized] = useState(false);

  // Sync fetched data into local state once
  if (existing.data && !initialized) {
    setConfig(existing.data);
    setInitialized(true);
  }

  const saveMut = trpc.generator.setSharedConfig.useMutation({
    onSuccess: () => onClose(),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{pluginName} Settings</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            These settings are shared across all {pluginName} instances.
          </p>

          {existing.isLoading && (
            <p className="text-sm text-muted-foreground">Loading...</p>
          )}

          {initialized && (
            <SharedPluginConfigFields
              pluginName={pluginName}
              config={config}
              onChange={setConfig}
            />
          )}

          {saveMut.error && (
            <p className="text-sm text-red-600">{saveMut.error.message}</p>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                saveMut.mutate({ pluginName, config })
              }
              disabled={saveMut.isPending || existing.isLoading}
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
