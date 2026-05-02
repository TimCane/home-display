#!/usr/bin/env sh
set -e

# Run Drizzle migrations
pnpm drizzle-kit migrate

exec node dist/server/index.js
