# 030 — Cookie parser duplicated three times

**Type:** Improvement
**Priority:** Low

## Problem

The same cookie parsing logic is implemented independently in three files. A bug fix or change in one won't propagate to the others.

## Where

- `src/web/server/auth/session.ts:100-108` — `getCookie()` function
- `src/web/server/auth/oauth.ts:135-143` — identical `getCookie()` function
- `src/web/server/trpc/context.ts:18-26` — inline cookie parsing

## Fix

Extract a single `getCookie(header: string | undefined, name: string): string | undefined` utility (e.g. in `src/web/server/auth/cookies.ts`) and import it in all three files.
