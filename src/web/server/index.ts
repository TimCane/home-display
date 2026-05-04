import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { boot } from "./boot.js";
import { authRoutes } from "./auth/oauth.js";
import { spaBounce } from "./auth/middleware.js";
import { appRouter } from "./trpc/index.js";
import { createContext } from "./trpc/context.js";
import { getEnv } from "./config/env.js";
import { framebufferRoute } from "./http/framebuffer.js";
import { draftCommitRoute } from "./http/draft-commit.js";
import { sseSystemRoute } from "./http/sse-system.js";
import { logger } from "./logger.js";

const app = new Hono();

// Global body size limit — 1 MB covers tRPC JSON payloads
app.use("*", bodyLimit({ maxSize: 1024 * 1024 }));

// Tighter limit on framebuffer upload (~200 KB; frame is exactly 163,200 bytes)
app.use("/api/draft/:id/commit", bodyLimit({ maxSize: 200 * 1024 }));

// Request logging
app.use("*", async (c, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  logger.info(
    {
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      ms,
    },
    "request",
  );
});

// Health check (public, no auth)
app.get("/api/health", (c) => c.json({ ok: true }));

// Mock display — dev only
if (process.env.NODE_ENV !== "production") {
  const { mockDisplay, initMockDisplay } = await import(
    "./mock-display/index.js"
  );
  app.route("/mock-display", mockDisplay);
  initMockDisplay();
}

// Auth routes
app.route("/api/auth", authRoutes);

// Framebuffer download endpoint
app.route("/api/framebuffer", framebufferRoute);

// Draft commit — raw-bytes framebuffer upload
app.route("/api/draft", draftCommitRoute);

// SSE system events
app.route("/api/sse/system", sseSystemRoute);

// tRPC — mounted at /api/trpc
app.use("/api/trpc/*", async (c) => {
  // CSRF: check Origin on mutations
  const method = c.req.method;
  if (method === "POST") {
    const origin = c.req.header("origin");
    if (origin) {
      const expected = new URL(getEnv().APP_BASE_URL).origin;
      const isDev = process.env.NODE_ENV !== "production";
      const isLocalhost =
        isDev && origin.startsWith("http://localhost:");
      if (origin !== expected && !isLocalhost) {
        return c.json({ error: "CSRF origin mismatch" }, 403);
      }
    }
  }

  const response = await fetchRequestHandler({
    endpoint: "/api/trpc",
    req: c.req.raw,
    router: appRouter,
    createContext,
  });
  return response;
});

// SPA bounce — redirect unauthenticated users to login
// Must come after /api/* routes so they aren't affected
app.use("/*", spaBounce);

// In production, serve the built React SPA
if (process.env.NODE_ENV === "production") {
  app.use("/*", serveStatic({ root: "./dist/client" }));
  // SPA fallback — serve index.html for non-API routes
  app.get("/*", serveStatic({ root: "./dist/client", path: "index.html" }));
}

const port = Number(process.env.PORT) || 3100;

async function main() {
  await boot();
  logger.info({ port }, "Server listening");
  serve({ fetch: app.fetch, port });
}

main();
