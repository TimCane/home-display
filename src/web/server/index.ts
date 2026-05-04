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
import { stopSchedulerCron } from "./scheduler/cron.js";
import { stopHealthCron } from "./health/cron.js";
import { stopAll as stopAllGenerators } from "./generators/runtime.js";
import { pool } from "./db/index.js";
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
const SHUTDOWN_TIMEOUT_MS = 30_000;

async function main() {
  await boot();
  const server = serve({ fetch: app.fetch, port });
  logger.info({ port }, "Server listening");

  let shuttingDown = false;

  async function shutdown(signal: string) {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, "Shutdown signal received, draining…");

    // Force-exit safety net
    const forceTimer = setTimeout(() => {
      logger.error("Graceful shutdown timed out, forcing exit");
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    forceTimer.unref();

    // 1. Stop accepting new connections and wait for in-flight requests
    await new Promise<void>((resolve) => {
      server.close((err) => {
        if (err) logger.error({ err }, "Error closing HTTP server");
        resolve();
      });
    });
    logger.info("HTTP server closed");

    // 2. Stop all cron tasks
    stopSchedulerCron();
    stopHealthCron();
    stopAllGenerators();
    logger.info("Cron tasks stopped");

    // 3. Close database pool
    try {
      await pool.end();
      logger.info("Database pool closed");
    } catch (err) {
      logger.error({ err }, "Error closing database pool");
    }

    logger.info("Shutdown complete");
    process.exit(0);
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main();
