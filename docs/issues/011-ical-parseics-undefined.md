# 011 — Cannot read properties of undefined (reading 'parseICS')

**Type:** Bug
**Severity:** High

## Problem

At runtime, calling `ical.sync.parseICS(icsText)` throws:

```
Cannot read properties of undefined (reading 'parseICS')
```

This is a CJS/ESM interop issue. The `node-ical` package is a CommonJS module imported via:

```ts
import * as ical from "node-ical";
```

Depending on the bundler/runtime configuration, the namespace import may not expose `sync` as a direct property — the actual module export ends up nested under a `default` key, making `ical.sync` undefined.

## Where

- `src/web/server/generators/calendar/fetch.ts:5` — the import
- `src/web/server/generators/calendar/fetch.ts:29` — the crash site (`ical.sync.parseICS(icsText)`)

## Fix

Use a default import or add a fallback to handle CJS interop:

```ts
import ical from "node-ical";
```

Or use the async API which avoids the `sync` namespace entirely:

```ts
const parsed = await ical.async.parseICS(icsText);
```

Either approach avoids the broken `sync` property access. If switching to the async API, the surrounding function is already `async` so no further changes are needed.
