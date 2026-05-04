# 004 — `as any` casts on tRPC errors

**Type:** Bug
**Severity:** Low

## Problem

Five client-side locations cast tRPC errors to `any` to access `.data.code`. This bypasses type safety and could mask real issues if the error shape changes.

## Where

- `src/web/client/trpc.ts:14` — `(error as any)?.data?.code === "UNAUTHORIZED"`
- `src/web/client/trpc.ts:47` — same pattern
- `src/web/client/pages/EditorPage.tsx:16` — `(error as any)?.data?.code`
- `src/web/client/pages/EditorPage.tsx:34` — `(draft.error as any)?.data?.code`
- `src/web/client/components/CreateEntryModal.tsx:60` — `(allowedElements as any)`

## Fix

Import and use `TRPCClientError` from `@trpc/client`:

```ts
import { TRPCClientError } from "@trpc/client";

if (error instanceof TRPCClientError) {
  if (error.data?.code === "UNAUTHORIZED") { ... }
}
```

For the `CreateEntryModal` cast, type the `allowedElements` state correctly to match the Zod schema so no cast is needed.
