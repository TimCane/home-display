#!/usr/bin/env sh
set -e

# Run Drizzle migrations (no-op until step 5 adds migration files)
pnpm drizzle-kit migrate 2>/dev/null || true

exec node dist/server/index.js
