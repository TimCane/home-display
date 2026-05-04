# 026 — Browser `confirm()` used for destructive actions

**Type:** Improvement
**Priority:** Medium

## Problem

Delete and revoke actions use the browser's native `confirm()` dialog, which blocks the UI thread, looks inconsistent with the rest of the app, and is especially poor on mobile.

## Where

- `src/web/client/pages/EntriesPage.tsx:112` — `confirm("Delete this entry?")`
- `src/web/client/pages/GeneratorsPage.tsx:165` — `confirm("Delete this instance and its entry?")`
- `src/web/client/pages/DraftsPage.tsx:141` — `confirm("Revoke this draft?")`

## Fix

Replace with a confirmation modal component that matches the existing Card/Button design system. A simple reusable `<ConfirmDialog>` with title, message, and confirm/cancel buttons.
