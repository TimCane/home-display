import type { ZodType } from "zod";

/**
 * A generator plugin fetches external data and renders it into a
 * 163,200-byte framebuffer that the scheduler treats like any other entry.
 */
export interface GeneratorPlugin<C = unknown> {
  /** Unique name, e.g. "weather", "calendar". */
  name: string;

  /**
   * Optional Zod schema for shared plugin-level config (e.g. credentials).
   * Stored once per plugin in the `plugin_configs` table and merged with
   * per-instance config before passing to fetch/renderers.
   */
  sharedConfigSchema?: ZodType;

  /** Zod schema that validates the per-instance config JSON. */
  configSchema: ZodType<C>;

  /** Pull and normalise external data. */
  fetch: (config: C) => Promise<unknown>;

  /**
   * Named renderers that turn fetched data into a framebuffer.
   * Each renderer must return exactly 163,200 bytes.
   */
  renderers: Record<
    string,
    (data: unknown, config: C) => Promise<Uint8Array>
  >;
}
