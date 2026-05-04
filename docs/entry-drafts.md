# Entry drafts

A draft is a pending editor session, addressable by URL. Both admin self-creation and guest-shared submission flow through the same drafts table. The `guest_mode` flag on the draft determines element filtering, the post-save modal behavior, and an extra auth gate.

No `entries` row exists until the editor commits.

## Lifecycle

1. Admin clicks the [+] button (topbar or "+ New entry" on the entries list) → "Create entry" modal.
2. Admin fills initial details (see [Modal fields](#modal-fields)). At minimum: decide whether `guest entry` is checked.
3. On save, a new `entry_drafts` row is created with a fresh UUID, `expires_at = now() + 24h`, and the chosen `guest_mode` + presets.
4. Modal behavior depends on `guest_mode`:
   - **`guest_mode = true`:** modal stays open showing the URL (`https://<domain>/editor/<uuid>`) and a QR code. Admin shares via any channel.
   - **`guest_mode = false`:** modal closes; the SPA navigates to `/editor/<uuid>`.
5. Editor page (`/editor/<uuid>`) loads. Auth gate: see [Auth](#auth).
6. Whoever's editing (guest or admin) sets the title, builds the image, previews dithered output, submits.
7. On successful submission:
   - `entries` row is created with `source = guest_mode ? 'guest' : 'admin'`, the dithered framebuffer, the title, and presets copied from the draft (`enabled`, `base_weight`, `conditions`, `submitter_name`). `show_count` initializes to `0`, so the global first-view boost applies on first eligibility.
   - `entry_drafts.consumed_at = now()`.
8. Subsequent visits to `/editor/<uuid>` show "this link has already been used."

If `now() > expires_at` and the draft is unconsumed: page shows "this link has expired."

## Modal fields

The modal opens lean. Title is *not* set here — it's set on the editor page itself.

**Always shown:**

| Field | Default | Notes |
|---|---|---|
| `guest entry` | unchecked | Toggles guest-mode behavior |
| **Advanced** disclosure (collapsed) | | Reveals scheduling presets |

**Advanced (collapsed):**

| Field | Default | Notes |
|---|---|---|
| `enabled` | `true` | If `false`, submitted entry lands disabled — soft-approval path |
| `base_weight` | 1 | |
| `conditions` | `[]` | Same condition types as admin entries. A stop-date is a `date_range` condition with just `to` set; the auto-disable sweep flips `enabled = false` once `to` is in the past. |

**Guest-mode only (revealed when `guest entry` is checked):**

| Field | Default | Notes |
|---|---|---|
| `submitter_name` | (required) | Admin-set. Autocomplete from previous submitters. Immutable post-submission. |
| `allowed_elements` | `["image_upload"]` | Subset of `image_upload`, `text`, `shapes`, `icons` |

For admin self-use (the typical case), the modal is one click — check nothing, hit save, get redirected.

## Editor page surface

`/editor/<uuid>` resolves to one of two editor variants based on **viewport width**:

- Desktop viewport → desktop canvas editor
- Narrow viewport → mobile editor

The draft's `guest_mode` flag does not change which variant renders. It does change:

1. **Element filter:** when `guest_mode = true`, the editor only exposes element types in `allowed_elements`. Default `["image_upload"]` collapses the editor to the simplest "pick an image" surface.
2. **Title field:** required to commit, on both editor variants. Submit button stays disabled until title + frame are present.
3. **Auth gate:** see [Auth](#auth).

A guest on a laptop sees the desktop editor with most tools hidden by `allowed_elements`. A guest on a phone sees the mobile editor with the same filter. Admin self-use respects viewport without a filter.

## Auth

The link UUID *is* the bearer credential; non-guest drafts additionally require an admin session at both load and commit. Full gate matrix and rationale: see [auth.md](auth.md#editor-auth--uuid-as-bearer--optional-admin-gate).

Drafts are minted by `POST /api/trpc/draft.create`, which itself requires admin session.

## Sharing (guest mode)

- URL: copy button.
- QR code: rendered in the modal, easy to scan from a phone.
- No built-in send-to integrations V1. Paste the URL anywhere yourself.

## Drafts list page

Shown to admin. Forever retention. Default filter: active only (`unconsumed AND not expired`). Toggles to show consumed / expired / revoked.

Per row:
- Status: `unconsumed` (with countdown to TTL) | `consumed` (with timestamp + link to resulting entry) | `expired` | `revoked`
- Mode: `guest` | `admin`
- Submitter name (guest only)
- Preset summary
- Actions:
  - Copy URL again
  - Re-show QR (guest only)
  - **Revoke** (sets `consumed_at = now()` to invalidate without ever being submitted)

The drafts list page does not have its own [+] button — drafts are created from the entries list / topbar.

## Trust model

The 24h TTL + single-use constraint bounds exposure of guest URLs. There is no admin approval queue between submission and the entry being eligible for display — the `enabled = false` preset is the manual-review escape hatch when needed.

## File format / size

Uniform across both modes:
- 20 MB max for the original upload (client-side enforced; backend rejects oversized payloads).
- Accepted: JPEG, PNG, WebP, HEIC.
- Rejected: GIF (animation is meaningless on e-paper).

## Edge cases

- **Admin authenticated, visits `/editor/<uuid>` of a guest-mode draft:** sees the editor as the guest would (URL is honored, identity is ignored). Useful for testing.
- **Multiple concurrent editors on the same URL:** the draft is single-use; whoever submits first consumes it. Others see "this link has already been used."
- **Admin abandons a non-guest draft:** sits as `unconsumed` until 24h TTL, then `expired`. Admin can revoke from the drafts list, or just let it expire. No background GC in V1.
- **Admin opens a non-guest URL on another logged-in admin's machine:** load-time gate passes (any admin session works); commit succeeds. By design — admin allowlist is per-deployment, not per-draft.
