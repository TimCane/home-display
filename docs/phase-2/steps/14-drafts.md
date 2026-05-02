# Step 14 — Drafts router + editor auth gate

## Goal

Backend support for the draft lifecycle in [entry-drafts.md](../entry-drafts.md): create, list, get, revoke, commit. The commit endpoint accepts a 163,200-byte framebuffer and creates the `entries` row. Per-draft auth gate from [auth.md § Editor auth](../auth.md#editor-auth--uuid-as-bearer--optional-admin-gate) becomes real.

## Depends on

Steps 8, 13.

## Files

- `src/web/server/trpc/routers/draft.ts`
- `src/web/server/auth/draft-gate.ts` — UUID-bearer + optional admin combined check
- `src/web/server/trpc/index.ts` — register `draft` router

## Tasks

1. `draft` router:
   - `create(input)` (admin-only): `{guest_mode, submitter_name?, allowed_elements?, enabled?, base_weight?, conditions?}`. Inserts `entry_drafts` row with `expires_at = now() + 24h`. Returns `{id}`.
   - `list({filter})` (admin-only): default `unconsumed AND not expired`; toggleable.
   - `get(id)` (public; gated by `draftGate`): returns draft metadata (not auth secrets). For non-guest drafts, fails without admin session.
   - `revoke(id)` (admin-only): set `consumed_at = now()`.
   - `commit(id, {title, frame: Uint8Array})` (gated by `draftGate`):
     - Atomically: re-check draft is unconsumed and not expired.
     - Validate frame is exactly 163,200 bytes.
     - INSERT `entries` row: `source = guest_mode ? 'guest' : 'admin'`, copy `enabled`, `base_weight`, `conditions`, `submitter_name` from draft, `framebuffer = frame`, `show_count = 0`.
     - SET `entry_drafts.consumed_at = now()`.
     - Return `{entry_id}`.
2. `draftGate` middleware:
   - Resolve draft by `id`. 404/410 if missing/consumed/expired.
   - If `guest_mode = false` and no admin session → 401.
   - Else allow.
3. Frame upload: `commit` accepts the frame either as a base64 string in the tRPC payload or via a sibling `POST /api/draft/<id>/commit` raw-bytes endpoint. Pick one and document it. (Recommended: raw-bytes endpoint to avoid base64 inflation; tRPC `commit` then takes only `{title}` and the file came in via the raw POST that minted a token.)
4. Wire `/editor/<uuid>` to *not* be bounced by SPA middleware (already done in step 8) — the draft gate handles it.

## Acceptance

- Admin creates a guest draft via `draft.create`, gets the URL, opens in incognito → `draft.get` succeeds without session.
- Admin creates a non-guest draft, opens in incognito → `draft.get` returns 401.
- `draft.commit` with a 163,200-byte frame creates an `entries` row with `source` matching `guest_mode`.
- A second `commit` against the same draft fails (already consumed).
- `revoke` flips `consumed_at`; subsequent `get` returns "no longer valid."

## Notes

- The editor UI itself lands in steps 19-21.
- Generator entries skip drafts entirely — see [data-model.md § Entry creation paths](../data-model.md#entry-creation-paths).
