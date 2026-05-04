/**
 * Searchable icon picker dropdown for selecting Lucide icons.
 * Shows a grid of icon thumbnails filtered by a search query.
 */

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { iconNames, loadIconNode, getIconNodeSync, type IconNode } from "./lucide-icon-data";

/** Render an icon's SVG paths into a small preview <svg>. */
function IconThumbnail({
  name,
  node,
  size = 20,
}: {
  name: string;
  node: IconNode | null;
  size?: number;
}) {
  if (!node) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <text x="12" y="16" textAnchor="middle" fontSize="14" fill="currentColor" stroke="none">?</text>
      </svg>
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {node.map(([tag, attrs], i) => {
        // Remove the "key" prop used by React internals in lucide
        const { key, ...svgAttrs } = attrs;
        // Convert camelCase attribute names to kebab-case for SVG
        const mapped: Record<string, string> = {};
        for (const [k, v] of Object.entries(svgAttrs)) {
          mapped[k] = v;
        }
        return createElement(tag, { ...mapped, key: `${name}-${i}` });
      })}
    </svg>
  );
}

// We need createElement for dynamic SVG elements
import { createElement } from "react";

const PAGE_SIZE = 80;

export function IconPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [loadedIcons, setLoadedIcons] = useState<Map<string, IconNode>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Filter icons by search
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return iconNames;
    return iconNames.filter((name) => name.includes(q));
  }, [search]);

  // Only show first PAGE_SIZE results for performance
  const visible = useMemo(() => filtered.slice(0, PAGE_SIZE), [filtered]);

  // Load visible icon data
  useEffect(() => {
    let cancelled = false;
    const toLoad = visible.filter((n) => !loadedIcons.has(n));
    if (toLoad.length === 0) return;

    Promise.all(
      toLoad.map(async (name) => {
        const node = await loadIconNode(name);
        return [name, node] as const;
      }),
    ).then((results) => {
      if (cancelled) return;
      setLoadedIcons((prev) => {
        const next = new Map(prev);
        for (const [name, node] of results) {
          if (node) next.set(name, node);
        }
        return next;
      });
    });

    return () => { cancelled = true; };
  }, [visible, loadedIcons]);

  // Also pre-load the currently selected icon
  useEffect(() => {
    if (value && !loadedIcons.has(value)) {
      loadIconNode(value).then((node) => {
        if (node) {
          setLoadedIcons((prev) => {
            const next = new Map(prev);
            next.set(value, node);
            return next;
          });
        }
      });
    }
  }, [value, loadedIcons]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Focus search input when opening
  useEffect(() => {
    if (open) {
      searchRef.current?.focus();
    }
  }, [open]);

  const handleSelect = useCallback(
    (name: string) => {
      onChange(name);
      setOpen(false);
    },
    [onChange],
  );

  const selectedNode = loadedIcons.get(value) ?? getIconNodeSync(value);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded border bg-background px-2 py-0.5 text-xs hover:bg-muted"
        title={`Icon: ${value}`}
      >
        <IconThumbnail name={value} node={selectedNode} size={16} />
        <span className="max-w-[80px] truncate">{value}</span>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-72 rounded-md border bg-popover shadow-lg">
          <div className="border-b p-2">
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search icons..."
              className="w-full rounded border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div className="grid max-h-64 grid-cols-8 gap-0.5 overflow-y-auto p-2">
            {visible.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => handleSelect(name)}
                className={`flex h-8 w-8 items-center justify-center rounded text-sm transition-colors ${
                  name === value
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground hover:bg-muted"
                }`}
                title={name}
              >
                <IconThumbnail
                  name={name}
                  node={loadedIcons.get(name) ?? null}
                  size={18}
                />
              </button>
            ))}
            {visible.length === 0 && (
              <div className="col-span-8 py-4 text-center text-xs text-muted-foreground">
                No icons found
              </div>
            )}
          </div>
          {filtered.length > PAGE_SIZE && (
            <div className="border-t px-2 py-1 text-center text-xs text-muted-foreground">
              Showing {PAGE_SIZE} of {filtered.length} — refine your search
            </div>
          )}
        </div>
      )}
    </div>
  );
}
