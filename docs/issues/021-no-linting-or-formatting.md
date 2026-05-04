# 021 — No linting or formatting configured

**Type:** Improvement
**Priority:** Medium

## Problem

The project has no ESLint or Prettier configuration. Nothing enforces code style beyond TypeScript's type checker. Inconsistencies accumulate silently and CI doesn't catch them.

## Where

- Project root — no `.eslintrc.*`, `eslint.config.*`, `.prettierrc.*`, or `prettier.config.*`
- `.github/workflows/ci.yml` — runs typecheck and test only, no lint step

## Fix

1. Add ESLint with `@typescript-eslint` and a flat config (`eslint.config.js`)
2. Add Prettier with a minimal config
3. Add `pnpm lint` and `pnpm format:check` scripts to `package.json`
4. Add a lint step to the CI workflow
5. Run the formatter once to baseline the codebase
