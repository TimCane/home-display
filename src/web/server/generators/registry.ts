import type { GeneratorPlugin } from "./types.js";
import { logger } from "../logger.js";

const plugins = new Map<string, GeneratorPlugin>();

/** Register a plugin at boot. Throws on duplicate name. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function registerPlugin(plugin: GeneratorPlugin<any>): void {
  if (plugins.has(plugin.name)) {
    throw new Error(`Generator plugin "${plugin.name}" already registered`);
  }
  plugins.set(plugin.name, plugin);
  logger.info({ plugin: plugin.name, renderers: Object.keys(plugin.renderers) }, "Plugin registered");
}

/** Get a plugin by name, or undefined. */
export function getPlugin(name: string): GeneratorPlugin | undefined {
  return plugins.get(name);
}

/** All registered plugins. */
export function listPlugins(): GeneratorPlugin[] {
  return [...plugins.values()];
}
