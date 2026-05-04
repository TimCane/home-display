import { useState, useEffect } from "react";
import { trpc } from "../trpc";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Check } from "lucide-react";

interface SettingGroup {
  label: string;
  keys: { key: string; label: string; type: "text" | "number" | "json" }[];
}

const SETTING_GROUPS: SettingGroup[] = [
  {
    label: "Palette",
    keys: [
      { key: "palette", label: "Palette (JSON)", type: "json" },
    ],
  },
  {
    label: "Scheduling",
    keys: [
      { key: "scheduler_cron", label: "Scheduler Cron", type: "text" },
      { key: "app_tz", label: "App Timezone", type: "text" },
      { key: "first_view_boost", label: "First View Boost", type: "number" },
      {
        key: "decay_half_life_hours",
        label: "Decay Half-Life (hours)",
        type: "number",
      },
    ],
  },
  {
    label: "Display",
    keys: [
      { key: "display_base_url", label: "Display Base URL", type: "text" },
      { key: "display_token", label: "Display Token", type: "text" },
    ],
  },
  {
    label: "Health",
    keys: [
      {
        key: "health_check_minutes",
        label: "Health Check Interval (min)",
        type: "number",
      },
    ],
  },
];

export function SettingsPage() {
  const settings = trpc.settings.getAll.useQuery();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>
      {settings.isLoading && (
        <p className="text-muted-foreground">Loading...</p>
      )}
      {settings.data && (
        <div className="space-y-6">
          {SETTING_GROUPS.map((group) => (
            <Card key={group.label}>
              <CardHeader>
                <CardTitle className="text-base">{group.label}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {group.keys.map((item) => (
                  <SettingField
                    key={item.key}
                    settingKey={item.key}
                    label={item.label}
                    type={item.type}
                    currentValue={settings.data[item.key]}
                  />
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function SettingField({
  settingKey,
  label,
  type,
  currentValue,
}: {
  settingKey: string;
  label: string;
  type: "text" | "number" | "json";
  currentValue: unknown;
}) {
  const utils = trpc.useUtils();
  const setMut = trpc.settings.set.useMutation({
    onSuccess: () => utils.settings.getAll.invalidate(),
  });

  const serialized =
    type === "json"
      ? JSON.stringify(currentValue, null, 2)
      : String(currentValue ?? "");

  const [value, setValue] = useState(serialized);
  const [dirty, setDirty] = useState(false);

  // Reset when upstream data changes
  useEffect(() => {
    setValue(serialized);
    setDirty(false);
  }, [serialized]);

  const save = () => {
    let parsed: unknown;
    if (type === "number") {
      parsed = Number(value);
    } else if (type === "json") {
      try {
        parsed = JSON.parse(value);
      } catch {
        return;
      }
    } else {
      parsed = value;
    }
    setMut.mutate({ key: settingKey, value: parsed });
  };

  return (
    <div>
      <label className="text-sm font-medium">{label}</label>
      <div className="mt-1 flex gap-2">
        {type === "json" ? (
          <textarea
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setDirty(true);
            }}
            rows={4}
            className="flex-1 rounded border bg-background px-3 py-2 text-sm font-mono"
          />
        ) : (
          <input
            type={type === "number" ? "number" : "text"}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setDirty(true);
            }}
            className="flex-1 rounded border bg-background px-3 py-2 text-sm"
          />
        )}
        <Button
          size="sm"
          onClick={save}
          disabled={!dirty || setMut.isPending}
          className="self-end"
        >
          <Check className="h-4 w-4" />
        </Button>
      </div>
      {setMut.error && (
        <p className="mt-1 text-xs text-red-600">{setMut.error.message}</p>
      )}
    </div>
  );
}
