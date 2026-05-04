# 028 — Checkbox labels not linked with id/htmlFor

**Type:** Bug
**Severity:** Low

## Problem

Flag toggle checkboxes across multiple pages wrap the input in a `<label>` but don't use `id`/`htmlFor` attributes. In some browsers and screen readers, clicking the label text doesn't toggle the checkbox, and the association isn't announced to assistive technology.

## Where

- `src/web/client/pages/DashboardPage.tsx:144-159` — flag checkboxes
- `src/web/client/pages/DiagnosticsPage.tsx:108-123` — flag checkboxes
- `src/web/client/pages/EntriesPage.tsx:275-282` — enabled checkbox in edit modal

## Fix

Add matching `id` and `htmlFor` attributes, or ensure the `<input>` is a direct child of `<label>` (which it already is in most cases — verify the wrapping is correct and the click target covers the label text).
