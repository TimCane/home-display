# 010 — Allowed elements mismatch between UI and backend

**Type:** Bug
**Severity:** High

## Problem

The Create Entry modal defines element options as:

```ts
const ELEMENT_OPTIONS = ["image_upload", "text", "shapes", "icons"] as const;
```

But the backend Zod schema expects individual element types:

```ts
z.enum(["image_upload", "text", "rect", "line", "circle", "icon"])
```

When a user selects "shapes" or "icons" in the UI, the backend rejects them with a validation error because those group names don't exist in the enum.

## Where

- `src/web/client/components/CreateEntryModal.tsx:11-16` — UI options use `"shapes"` and `"icons"`
- `src/web/server/trpc/routers/draft.ts:10-12` — backend expects `"rect"`, `"line"`, `"circle"`, `"icon"`

## Fix

Two options:

1. **Expand the UI to show individual elements** — replace `"shapes"` with `"rect"`, `"line"`, `"circle"` and `"icons"` with `"icon"`. More granular control but noisier UI.

2. **Map grouped UI labels to individual backend values** — keep the grouped UI (`"shapes"`, `"icons"`) but expand them before sending to the backend:
   - `"shapes"` -> `["rect", "line", "circle"]`
   - `"icons"` -> `["icon"]`

   This also requires collapsing when reading back from the server for edit display.

Option 1 is simpler and avoids a mapping layer. The modal is already behind an "Advanced" disclosure for guest entries, so the extra granularity is fine.

Also fix the `as any` cast on line 60 — once the values match the schema, the type should align naturally.
