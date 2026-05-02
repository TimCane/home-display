# Step 2 — Restructure repo

## Goal

Move phase-1 firmware into `src/firmware/` so the repo root is free for the web app. Confirm firmware still builds with PlatformIO.

## Depends on

Nothing.

## Files

- `platformio.ini` — update `src_dir` and `test_dir`.
- `src/` (new) — wraps existing source.
- `test/firmware/` — receives existing Unity tests.
- `.gitignore` — sanity check for any `src/` patterns that might mask the new tree.

## Tasks

1. `git mv` current top-level firmware sources under `src/firmware/` (preserve subfolder layout: `app/`, `display/`, `http/`, `net/`, `persist/`, `config/`, `main.cpp`).
2. `git mv` existing Unity test directory under `test/firmware/`.
3. In `platformio.ini`, set `src_dir = src/firmware` and `test_dir = test/firmware`.
4. Run `pio run` and `pio test` (or whatever the existing local build commands are) to confirm green.
5. Skim `docs/firmware.md` and `docs/api.md` for now-broken path references; fix or note if any remain.

## Acceptance

- `pio run` builds clean.
- `pio test` (firmware Unity tests) passes.
- No source files left at top level except config (`platformio.ini`, `package.json`-to-come, etc.).

## Notes

- This is the only step that touches the firmware tree. From step 3 onwards everything is additive under `src/web/`.
- See [architecture.md § Repo layout](../architecture.md#repo-layout) for the target tree.
