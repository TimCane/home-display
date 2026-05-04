import { useSyncExternalStore } from "react";

const BREAKPOINT = "(min-width: 900px)";

function subscribe(cb: () => void) {
  const mql = window.matchMedia(BREAKPOINT);
  mql.addEventListener("change", cb);
  return () => mql.removeEventListener("change", cb);
}

function getSnapshot() {
  return window.matchMedia(BREAKPOINT).matches ? "desktop" : "mobile";
}

export type Viewport = "desktop" | "mobile";

/** Returns "desktop" when viewport >= 900px, "mobile" otherwise. */
export function useViewport(): Viewport {
  return useSyncExternalStore(subscribe, getSnapshot, () => "desktop");
}
