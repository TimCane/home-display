# 002 — Dockerfile missing tsconfig.shared.json

**Type:** Bug
**Severity:** Medium

## Problem

The Dockerfile build stage copies three tsconfig files:

```dockerfile
COPY tsconfig.json tsconfig.server.json tsconfig.client.json vite.config.ts ./
```

But `tsconfig.shared.json` is missing. The `pnpm build` script runs `tsc -p tsconfig.server.json`, which may reference the shared config via `references` or `extends`. If the shared config is needed for path resolution or type checking, the Docker build could silently skip shared type validation or fail outright.

## Where

- `Dockerfile:10`
- `tsconfig.shared.json` — exists at repo root, not copied

## Fix

Add `tsconfig.shared.json` to the COPY line:

```dockerfile
COPY tsconfig.json tsconfig.server.json tsconfig.client.json tsconfig.shared.json vite.config.ts ./
```
