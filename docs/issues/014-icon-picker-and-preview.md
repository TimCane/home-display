# 014 — Icons are hard to use — no search and no live preview

**Type:** Bug
**Severity:** High

## Problem

The icon tool in the editor has two usability issues:

1. **No way to search or browse icons** — the only way to pick an icon is to type its exact Lucide name into a tiny text input (`PropertiesBar.tsx`). With ~1,600+ Lucide icons available, users have no way to discover what's available. They must already know the name (e.g. `"calendar"`, `"trash-2"`).

2. **Canvas doesn't reflect the chosen icon** — the `renderIcon` function draws a hardcoded `◆` diamond placeholder regardless of the `iconName`. Changing the icon name has no visible effect on the canvas, so there's no feedback on whether the name is valid or what the icon looks like.

## Where

- `src/web/client/editor/desktop/PropertiesBar.tsx:171-182` — plain text input for `iconName`, no search or autocomplete
- `src/web/client/editor/desktop/layers/render.ts:120-135` — `renderIcon()` ignores `layer.iconName`, always draws `◆`
- `src/web/client/editor/desktop/Toolbox.tsx:191-205` — creates icon layer with default name `"star"`

## Fix

### 1. Searchable icon picker

Replace the raw text input with a searchable dropdown/popover:

- Import the Lucide icon name list (available as `icons` from `lucide-react` or from the `lucide-static` package's metadata)
- Add a popover/dropdown that shows a grid of icon thumbnails filtered by a search input
- Clicking an icon sets `layer.iconName` and closes the picker
- Show the currently selected icon next to the search field for confirmation

### 2. Render actual icons on the canvas

Replace the `◆` placeholder in `renderIcon()` with the real Lucide SVG path data:

- Use `lucide-static` or extract path data from `lucide-react` for the given `iconName`
- Create an offscreen SVG string, convert to a data URL, load as an `Image`, then `drawImage` onto the canvas at the layer bounds
- Cache the resulting `Image` per icon name + color + size to avoid re-creating every frame (similar to the existing `imageCache` pattern for image layers)
- Fall back to a question-mark icon or the `◆` if the name doesn't match a known icon

This ensures the canvas updates immediately when the icon name changes.
