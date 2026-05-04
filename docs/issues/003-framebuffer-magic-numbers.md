# 003 — Hardcoded framebuffer size magic numbers

**Type:** Bug
**Severity:** Low

## Problem

Three files hardcode `163_200` instead of importing the shared `FRAME_BYTES` constant from `src/web/shared/framebuffer.ts`. If the display resolution ever changes, these would silently fall out of sync.

## Where

- `src/web/server/mock-display/index.ts:5` — `const EXPECTED_BODY_SIZE = 163_200`
- `src/web/server/generators/runtime.ts:15` — `const FRAMEBUFFER_SIZE = 163_200`
- `src/web/server/trpc/routers/generator.ts:14` — `const FRAMEBUFFER_SIZE = 163_200`

## Fix

Replace each local constant with:

```ts
import { FRAME_BYTES } from "../../shared/framebuffer.js";
```

Adjust the relative path per file.
