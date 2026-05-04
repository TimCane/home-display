/**
 * Font registration for server-side canvas rendering.
 *
 * Registers the bundled Inter font family with @napi-rs/canvas so that
 * all generator renderers produce consistent, good-looking output
 * regardless of which system fonts the host OS has installed.
 *
 * Call `registerFonts()` once during server startup.
 */

import { GlobalFonts } from "@napi-rs/canvas";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** The font family name used across all canvas renderers. */
export const DISPLAY_FONT = "Inter";

let registered = false;

/** Register bundled Inter font files with the canvas runtime. */
export function registerFonts(): void {
  if (registered) return;

  GlobalFonts.registerFromPath(join(__dirname, "Inter-Regular.ttf"), "Inter");
  GlobalFonts.registerFromPath(join(__dirname, "Inter-Bold.ttf"), "Inter");
  GlobalFonts.registerFromPath(join(__dirname, "Inter-Italic.ttf"), "Inter");

  registered = true;
}
