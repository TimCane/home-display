import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { boot } from "./boot.js";

const app = new Hono();

// Health check
app.get("/api/health", (c) => c.json({ ok: true }));

// In production, serve the built React SPA
if (process.env.NODE_ENV === "production") {
  app.use("/*", serveStatic({ root: "./dist/client" }));
  // SPA fallback — serve index.html for non-API routes
  app.get("/*", serveStatic({ root: "./dist/client", path: "index.html" }));
}

const port = Number(process.env.PORT) || 3100;

async function main() {
  await boot();
  console.log(`Server listening on http://localhost:${port}`);
  serve({ fetch: app.fetch, port });
}

main();
