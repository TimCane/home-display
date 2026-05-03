import type { GeneratorPlugin } from "./types.js";

const plugins = new Map<string, GeneratorPlugin>();

/** Register a plugin at boot. Throws on duplicate name. */
export function registerPlugin(plugin: GeneratorPlugin): void {
  if (plugins.has(plugin.name)) {
    throw new Error(`Generator plugin "${plugin.name}" already registered`);
  }
  plugins.set(plugin.name, plugin);
  console.log(
    `[generators] Plugin registered: ${plugin.name} (renderers: ${Object.keys(plugin.renderers).join(", ")})`,
  );
}

/** Get a plugin by name, or undefined. */
export function getPlugin(name: string): GeneratorPlugin | undefined {
  return plugins.get(name);
}

/** All registered plugins. */
export function listPlugins(): GeneratorPlugin[] {
  return [...plugins.values()];
}
