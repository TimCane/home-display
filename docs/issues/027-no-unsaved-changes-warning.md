# 027 — No unsaved-changes warning in editor

**Type:** Bug
**Severity:** Low

## Problem

Navigating away from the editor (browser back, closing tab, clicking a sidebar link) silently discards all unsaved work. There is no `beforeunload` handler or navigation guard.

## Where

- `src/web/client/editor/EditorShell.tsx` — no `beforeunload` event listener

## Fix

Add a `useEffect` that registers a `beforeunload` handler when the editor has unsaved changes (i.e. layers have been modified since the last save/submit). The browser will show a native "Leave site?" prompt.

For in-app navigation (React Router), also add a route-leave guard using the router's blocking mechanism.
