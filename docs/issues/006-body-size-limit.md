# 006 — No request body size limit

**Type:** Improvement
**Priority:** Medium

## Problem

The Hono server does not enforce a maximum request body size. The draft commit endpoint (`POST /api/draft/:id/commit`) expects exactly 163,200 bytes but will happily read an arbitrarily large body into memory before rejecting it. Same applies to tRPC mutation payloads.

An attacker or misbehaving client could send a multi-GB body and exhaust server memory.

## Where

- `src/web/server/index.ts` — no body size middleware
- `src/web/server/http/draft-commit.ts` — reads full body before size check

## Fix

Add Hono body limit middleware:

```ts
import { bodyLimit } from "hono/body-limit";

// Global default — generous enough for tRPC JSON payloads
app.use("*", bodyLimit({ maxSize: 1024 * 1024 })); // 1 MB

// Tighter limit on the framebuffer upload endpoint
app.use("/api/draft/:id/commit", bodyLimit({ maxSize: 200 * 1024 })); // ~200 KB
```

The framebuffer is exactly 163,200 bytes (~159 KB), so 200 KB gives comfortable headroom.
