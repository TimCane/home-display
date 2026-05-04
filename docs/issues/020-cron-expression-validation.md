# 020 — Cron expressions not validated

**Type:** Bug
**Severity:** High

## Problem

The `scheduler_cron` setting and generator `cronExpr` fields are validated only as `z.string().min(1)`. An invalid expression (e.g. `"banana"`) is accepted by the API but crashes `node-cron` at runtime when it tries to schedule the task.

## Where

- `src/web/server/config/schema.ts:24-27` — `scheduler_cron` schema is `z.string().min(1)`
- `src/web/server/trpc/routers/generator.ts:56` — create instance `cronExpr` is `z.string().min(1)`
- `src/web/server/trpc/routers/generator.ts:124` �� update instance `cronExpr` is `z.string().min(1)`

## Fix

Use `node-cron`'s `cron.validate(expr)` function in a Zod `.refine()`:

```ts
import cron from "node-cron";

const cronSchema = z.string().min(1).refine(
  (v) => cron.validate(v),
  { message: "Invalid cron expression" },
);
```

Apply to both the settings schema and the generator router inputs.
