import { Button } from "./ui/button";
import type { Condition } from "../../shared/conditions";
import { Trash2, Plus } from "lucide-react";

const CONDITION_TYPES = [
  "time_window",
  "day_of_week",
  "date_range",
  "manual_flag",
  "freshness",
  "recently_updated",
] as const;

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

function defaultCondition(type: Condition["type"]): Condition {
  switch (type) {
    case "time_window":
      return { type, params: { from: "08:00", to: "22:00" } };
    case "day_of_week":
      return { type, params: { days: ["mon", "tue", "wed", "thu", "fri"] } };
    case "date_range":
      return { type, params: {} };
    case "manual_flag":
      return { type, params: { flag: "" } };
    case "freshness":
      return { type, params: { not_shown_in_last_hours: 1 } };
    case "recently_updated":
      return { type, params: { updated_within_hours: 24 } };
  }
}

function conditionLabel(type: string): string {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

interface ConditionsEditorProps {
  value: Condition[];
  onChange: (conditions: Condition[]) => void;
}

export function ConditionsEditor({ value, onChange }: ConditionsEditorProps) {
  const update = (index: number, condition: Condition) => {
    const next = [...value];
    next[index] = condition;
    onChange(next);
  };

  const remove = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const add = (type: Condition["type"]) => {
    onChange([...value, defaultCondition(type)]);
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        All conditions are AND-ed. Empty = always eligible.
      </p>
      {value.map((condition, i) => (
        <div key={i} className="flex items-start gap-2 rounded border p-3">
          <div className="flex-1 space-y-2">
            <div className="text-xs font-medium">
              {conditionLabel(condition.type)}
            </div>
            <ConditionFields
              condition={condition}
              onChange={(c) => update(i, c)}
            />
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => remove(i)}
            className="shrink-0"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <div className="flex flex-wrap gap-1">
        {CONDITION_TYPES.map((type) => (
          <Button
            key={type}
            variant="outline"
            size="sm"
            onClick={() => add(type)}
          >
            <Plus className="mr-1 h-3 w-3" />
            {conditionLabel(type)}
          </Button>
        ))}
      </div>
    </div>
  );
}

function ConditionFields({
  condition,
  onChange,
}: {
  condition: Condition;
  onChange: (c: Condition) => void;
}) {
  switch (condition.type) {
    case "time_window":
      return (
        <div className="flex items-center gap-2">
          <input
            type="time"
            value={condition.params.from}
            onChange={(e) =>
              onChange({
                ...condition,
                params: { ...condition.params, from: e.target.value },
              })
            }
            className="rounded border bg-background px-2 py-1 text-sm"
          />
          <span className="text-xs text-muted-foreground">to</span>
          <input
            type="time"
            value={condition.params.to}
            onChange={(e) =>
              onChange({
                ...condition,
                params: { ...condition.params, to: e.target.value },
              })
            }
            className="rounded border bg-background px-2 py-1 text-sm"
          />
        </div>
      );

    case "day_of_week":
      return (
        <div className="flex flex-wrap gap-1">
          {DAYS.map((day) => {
            const active = condition.params.days.includes(day);
            return (
              <button
                key={day}
                onClick={() => {
                  const days = active
                    ? condition.params.days.filter((d) => d !== day)
                    : [...condition.params.days, day];
                  onChange({
                    ...condition,
                    params: { days: days as typeof condition.params.days },
                  });
                }}
                className={`rounded px-2 py-0.5 text-xs font-medium border ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-muted-foreground"
                }`}
              >
                {day}
              </button>
            );
          })}
        </div>
      );

    case "date_range":
      return (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={condition.params.from ?? ""}
            onChange={(e) =>
              onChange({
                ...condition,
                params: {
                  ...condition.params,
                  from: e.target.value || undefined,
                },
              })
            }
            className="rounded border bg-background px-2 py-1 text-sm"
          />
          <span className="text-xs text-muted-foreground">to</span>
          <input
            type="date"
            value={condition.params.to ?? ""}
            onChange={(e) =>
              onChange({
                ...condition,
                params: {
                  ...condition.params,
                  to: e.target.value || undefined,
                },
              })
            }
            className="rounded border bg-background px-2 py-1 text-sm"
          />
        </div>
      );

    case "manual_flag":
      return (
        <input
          type="text"
          value={condition.params.flag}
          onChange={(e) =>
            onChange({
              ...condition,
              params: { flag: e.target.value },
            })
          }
          placeholder="Flag name"
          className="rounded border bg-background px-2 py-1 text-sm w-full"
        />
      );

    case "freshness":
      return (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            Not shown in last
          </span>
          <input
            type="number"
            min={0}
            value={condition.params.not_shown_in_last_hours}
            onChange={(e) =>
              onChange({
                ...condition,
                params: { not_shown_in_last_hours: Number(e.target.value) },
              })
            }
            className="w-20 rounded border bg-background px-2 py-1 text-sm"
          />
          <span className="text-xs text-muted-foreground">hours</span>
        </div>
      );

    case "recently_updated":
      return (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Updated within</span>
          <input
            type="number"
            min={0}
            value={condition.params.updated_within_hours}
            onChange={(e) =>
              onChange({
                ...condition,
                params: { updated_within_hours: Number(e.target.value) },
              })
            }
            className="w-20 rounded border bg-background px-2 py-1 text-sm"
          />
          <span className="text-xs text-muted-foreground">hours</span>
        </div>
      );
  }
}
