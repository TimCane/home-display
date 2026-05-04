import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Dev-mode auth bounce: checks for session cookie before serving the SPA.
 * Redirects unauthenticated page requests to the backend's OAuth login flow.
 * In production, the Hono spaBounce middleware handles this.
 */
function authBounce(): Plugin {
  return {
    name: "auth-bounce",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url || "/";
        // Skip API routes, editor routes, static assets, and Vite internals
        if (
          url.startsWith("/api/") ||
          url.startsWith("/editor/") ||
          url.startsWith("/@") ||
          url.startsWith("/node_modules/") ||
          url.startsWith("/src/") ||
          url.includes(".")
        ) {
          return next();
        }
        // Check for session cookie
        const cookies = req.headers.cookie || "";
        const hasSession = cookies
          .split(";")
          .some((c) => c.trim().startsWith("session="));
        if (!hasSession) {
          const returnTo = encodeURIComponent(url);
          res.writeHead(302, {
            Location: `/api/auth/login?return_to=${returnTo}`,
          });
          res.end();
          return;
        }
        next();
      });
    },
  };
}

export default defineConfig({
  root: "src/web/client",
  plugins: [authBounce(), react()],
  build: {
    outDir: "../../../dist/client",
    emptyOutDir: true,
  },
  server: {
    host: "0.0.0.0",
    proxy: {
      "/api": {
        target: "http://localhost:3100",
        changeOrigin: true,
      },
    },
  },
});
