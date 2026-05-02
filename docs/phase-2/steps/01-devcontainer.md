# Step 1 — Dev container

## Goal

Stand up a reproducible dev container so every subsequent step can be developed and tested inside the same environment. Postgres lands later (step 4); this step is just the Node/TypeScript shell for working on the repo.

## Depends on

Nothing.

## Files

- `.devcontainer/devcontainer.json`
- (later) `.devcontainer/docker-compose.yml` if/when the container needs a sibling Postgres for in-container dev. Defer until step 4 makes that needed.

## Tasks

1. Create `.devcontainer/devcontainer.json` based on the user's template:
   ```json
   {
     "name": "new-home-display",
     "image": "mcr.microsoft.com/devcontainers/typescript-node:1-20-bullseye",
     "forwardPorts": [4321],
     "portsAttributes": {
       "4321": {
         "label": "Application",
         "onAutoForward": "openBrowser"
       }
     },
     "postCreateCommand": "npm install",
     "postAttachCommand": "npm run dev",
     "customizations": {
       "vscode": {
         "extensions": [
           "bradlc.vscode-tailwindcss",
           "DavidAnson.vscode-markdownlint",
           "anthropic.claude-code",
           "dbaeumer.vscode-eslint",
           "esbenp.prettier-vscode"
         ]
       }
     },
     "runArgs": ["--net=host"],
     "features": {
       "ghcr.io/timcane/devcontainer-features/claude-code-passthrough:latest": {}
     }
   }
   ```
2. Choose a port for the dev server and use it consistently across this file, the Vite config (step 3), and `.env.example` (step 22). The template uses `4321`; keep it unless there's a clash.
3. Confirm Node 20 matches the version Step 3 will pin in `package.json` `engines` and the Dockerfile (step 4). Bumping the devcontainer image later is cheap; pinning once now avoids drift.
4. Drop the `astro-build.astro-vscode` extension from the template (we're not using Astro). Add Tailwind, ESLint, Prettier extensions since the project uses them.
5. Note: `postAttachCommand: "npm run dev"` will fail until step 3 lands `package.json`. That's fine — the first attach after step 1 won't have anything to run. Verify the container *builds and attaches* in this step; running the dev server is a step-3 acceptance.
6. Add `.devcontainer/` to `.dockerignore` (created in step 4) so dev container config doesn't leak into the production image.

## Acceptance

- Open the repo in VS Code → "Reopen in Container" → container builds and attaches.
- `node --version` inside the container reports Node 20.
- `which claude` resolves (the `claude-code-passthrough` feature is installed).
- VS Code extensions listed in `customizations.vscode.extensions` are present.
- `--net=host` works on the user's host (Linux); if developing on a Mac/Windows host later, this will need revisiting (host networking is Linux-only on Docker Desktop).

## Notes

- The `claude-code-passthrough` feature relies on the user's host Claude Code install — confirm that's set up before assuming it'll work.
- Postgres will be added to the dev container via `docker-compose` in step 4 (or developed against the host's Postgres / a sibling container started manually until then).
- If `--net=host` becomes a portability problem, switch to explicit `forwardPorts` for every port the stack exposes (HTTP, Vite HMR, Postgres, mock display).
