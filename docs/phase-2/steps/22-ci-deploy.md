# Step 22 — CI + deploy

## Goal

Lock in the CI guardrails and document the deploy path so production is reproducible. Per [ops.md § CI/CD](../ops.md#cicd) and [ops.md § Deploy](../ops.md#deploy).

## Depends on

All prior steps.

## Files

- `.github/workflows/ci.yml`
- `.env.example` — kept in sync with [config.md § Env](../config.md#env-must-be-env)
- `docs/phase-2/deploy-runbook.md` (new) — Coolify setup + first-deploy checklist

## Tasks

1. GitHub Actions on PR:
   - Setup pnpm + Node (matching the Dockerfile).
   - `pnpm install --frozen-lockfile`.
   - `pnpm typecheck`.
   - `pnpm test`.
   - (Optional V1) `docker compose build` to catch Dockerfile breakage.
2. Cache `~/.pnpm-store` and `node_modules`.
3. Verify `.env.example` lists every required env var; document each.
4. Deploy runbook covers:
   - Coolify project + GitHub webhook setup.
   - Postgres volume + nightly backup configuration.
   - Initial env-var provisioning checklist.
   - First-deploy steps: confirm migration ran, set `display_base_url` + `display_token` via Settings page, configure GitHub OAuth callback URL.
   - Rotating `display_token` (requires firmware reflash).
5. Confirm `pnpm build && pnpm start` and `docker compose up --build` both work from a clean checkout.

## Acceptance

- A PR with a deliberately broken type fails CI.
- A clean clone + `cp .env.example .env` (filled) + `docker compose up --build` brings up a working stack.
- Pushing to `main` triggers Coolify and the deployed app comes up green.

## Notes

- No external log aggregator, no metrics, no alerting in V1 — these are accepted gaps per [ops.md § Observability gaps](../ops.md#observability-gaps-v1-accepts).
- Backup *restore* drill is called out as a TODO before long-term prod and stays a TODO here.
