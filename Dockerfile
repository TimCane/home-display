# ── deps ──────────────────────────────────────────────────────────
FROM node:20-slim AS deps
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# ── build ─────────────────────────────────────────────────────────
FROM deps AS build
COPY tsconfig.json tsconfig.server.json tsconfig.client.json tsconfig.shared.json vite.config.ts postcss.config.js ./
COPY src/web/ src/web/
RUN pnpm build

# ── runtime ───────────────────────────────────────────────────────
FROM node:20-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends \
    libfontconfig1 \
    && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

COPY --from=build /app/dist dist
COPY src/web/server/db/migrations src/web/server/db/migrations
COPY src/web/server/fonts/*.ttf dist/server/server/fonts/
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

ENV NODE_ENV=production
EXPOSE 3100

ENTRYPOINT ["./docker-entrypoint.sh"]
