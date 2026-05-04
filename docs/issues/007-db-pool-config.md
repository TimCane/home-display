# 007 — No DB connection pool config

**Type:** Improvement
**Priority:** Low

## Problem

The Postgres connection is created with default pool settings from the `pg` driver. No explicit configuration for pool size, idle timeout, or connection timeout. The defaults are generally fine for a single-server hobby project, but worth making explicit so production behaviour is predictable.

## Where

- `src/web/server/db/` — Drizzle setup, likely using default `pg.Pool`

## Fix

Make pool settings explicit in the DB setup:

```ts
const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 10,               // max connections
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});
```

These are reasonable defaults — making them explicit just prevents surprises if the `pg` library changes its defaults.
