/**
 * Utility to load Lucide icon node data (SVG element definitions) by name.
 *
 * Each icon is lazily loaded via dynamicIconImports from lucide-react.
 * The __iconNode export is an array of [elementType, attributes] tuples
 * that describe the SVG paths/shapes within a 24x24 viewBox.
 */

import dynamicIconImports from "lucide-react/dynamicIconImports";

export type IconNode = [string, Record<string, string>][];

/** Cache of loaded icon node data keyed by icon name. */
const cache = new Map<string, IconNode>();

/** All available icon names (kebab-case). */
export const iconNames: string[] = Object.keys(dynamicIconImports).sort();

/**
 * Load the icon node data for a given icon name.
 * Returns the cached value if already loaded, otherwise dynamically imports it.
 */
export async function loadIconNode(name: string): Promise<IconNode | null> {
  const cached = cache.get(name);
  if (cached) return cached;

  const loader = (dynamicIconImports as Record<string, (() => Promise<{ __iconNode?: IconNode }>) | undefined>)[name];
  if (!loader) return null;

  try {
    const mod = await loader();
    const node = mod.__iconNode ?? null;
    if (node) {
      cache.set(name, node);
    }
    return node;
  } catch {
    return null;
  }
}

/**
 * Get the icon node data synchronously (from cache only).
 * Returns null if the icon hasn't been loaded yet.
 */
export function getIconNodeSync(name: string): IconNode | null {
  return cache.get(name) ?? null;
}
