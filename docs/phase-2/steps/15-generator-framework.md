# Step 15 — Generator framework

## Goal

Plugin registry + instance lifecycle from [generators.md](../generators.md): register plugins at boot, manage instance crons, run with error isolation, log every run, expose `generator` tRPC router. No actual plugins yet.

## Depends on

Steps 5, 7, 10, 12.

## Files

- `src/web/server/generators/registry.ts` — plugin interface + register/list
- `src/web/server/generators/runtime.ts` — per-instance cron registration, run executor
- `src/web/server/generators/types.ts` — `GeneratorPlugin`, `Renderer` types
- `src/web/server/trpc/routers/generator.ts`
- `src/web/server/boot.ts` — register plugins, then load + register instance crons

## Tasks

1. Plugin shape:
   ```ts
   type GeneratorPlugin<C> = {
     name: string;
     configSchema: ZodSchema<C>;
     fetch: (config: C) => Promise<unknown>;
     renderers: Record<string, (data: unknown, config: C) => Promise<Uint8Array /* 163,200 */>>;
   };
   ```
2. `registry.ts`: in-memory map of `name → plugin`. `registerPlugin(p)` called at boot.
3. `runtime.ts`:
   - `registerInstance(instance)`: parse `cron_expr`, schedule a callback wrapped in try/catch.
   - Callback: resolve plugin, run `fetch`, run renderer, validate 163,200 bytes, UPDATE `entries.framebuffer` (which bumps `updated_at`), INSERT `generator_runs` `succeeded=true`.
   - On exception: log via pino, INSERT `generator_runs` `succeeded=false, error=msg`. Leave existing framebuffer untouched.
   - `unregisterInstance(id)`, `reregisterInstance(id)` for create/update/delete.
4. On instance create:
   - INSERT placeholder `entries` row (`enabled=false`, no conditions, `title = instance_name`, framebuffer = blank/zeroed 163,200 bytes).
   - INSERT `generator_instances` row with the new `entry_id`.
   - Register cron.
   - Optionally `runNow()` immediately.
5. On instance delete:
   - Unregister cron.
   - DELETE the `entries` row (cascade via FK, or explicit).
6. `generator` tRPC router:
   - `listPlugins()` → `[{name, renderers, configSchemaJson}]`.
   - `listInstances()` → all rows + last run summary.
   - `createInstance({plugin, renderer, instance_name, config, cron_expr})`.
   - `updateInstance(id, patch)`.
   - `deleteInstance(id)`.
   - `runNow(id)` → manual trigger.
   - `recentRuns(instanceId, limit)`.
7. Boot sequence: register plugins → query `generator_instances` → register a cron per row.

## Acceptance

- A test plugin registered at boot with a renderer that returns zero-bytes-of-correct-length, plus an instance with a `* * * * *` cron, results in a `generator_runs` row every minute.
- Throwing renderer logs an error, leaves the previous framebuffer in place, and `succeeded=false` row appears.
- `deleteInstance` removes both the cron and the entry.

## Notes

- Validating `Uint8Array.length === 163_200` is the runtime guard; the DB CHECK is the belt.
- The placeholder entry on create exists so admins can configure conditions/enabled before the first real render lands.
