# Guest links

Time-bounded, single-use URLs that let trusted people submit one image to the display. Created by the admin with all options pre-set; the guest only uploads.

## Lifecycle

1. Admin opens the "Guest Links" page → "Create guest link" modal.
2. Admin fills the preset options (see below) and submits. A new `guest_links` row is created with a fresh UUID and `expires_at = now() + 24h`.
3. Modal stays open showing the URL (`https://<domain>/g/<uuid>`) and a QR code. Admin shares via any channel.
4. Guest visits the URL. The page reads `preset_options` and presents the editor (mobile-first, same surface as the mobile editor) with `allowed_elements` toggles enforced.
5. Guest uploads / composes → previews dithered output → submits.
6. On successful submission:
   - `entries` row is created with `source='guest'`, the dithered framebuffer, and `preset_options` populating `enabled`, `base_weight`, `conditions`, `expires_at`, `first_view_boost`, `submitter_name`.
   - `guest_links.consumed_at = now()`.
7. Subsequent visits to `/g/<uuid>` show "this link has already been used."

If `now() > expires_at` and the link is unconsumed: page shows "this link has expired."

## Preset options (set at link creation)

| Field | Default | Notes |
|---|---|---|
| `submitter_name` | (required) | Admin-set. Autocomplete from previous submitters' names. Immutable post-submission. |
| `enabled` | `true` | If `false`, submitted entry lands disabled — the soft-approval path. Admin enables it from the entry list. |
| `base_weight` | 1 | |
| `conditions` | `[]` | Same condition types as admin entries |
| `expires_at` | `+7 days` (configurable) | Auto-disable the resulting entry after this |
| `first_view_boost` | configurable, default e.g. `+10` | Extra weight while unshown |
| `allowed_elements` | `["image_upload"]` | Subset of `image_upload`, `text`, `shapes`, `icons` |

The guest's editor surface is the *mobile editor* with element types filtered by `allowed_elements`. Default link gives just image upload; admin can broaden it for trusted guests.

## Sharing

- URL: copy button.
- QR code: rendered in the modal, easy to scan from a phone.
- No built-in send-to integrations V1. Paste the URL anywhere yourself.

## Guest links list page

Shown to admin. Forever retention. UI filtering for "hide expired" / "hide consumed."

Per row:
- Status: `unconsumed` (with countdown to TTL) | `consumed` (with timestamp + link to resulting entry) | `expired` | `revoked`
- Submitter name
- Preset options summary
- Actions:
  - Copy URL again
  - Re-show QR
  - **Revoke** (sets `consumed_at = now()` to invalidate without ever being submitted)

## Auth model

The link UUID *is* the bearer for guest submission. No password, no identity check. The 24h TTL + single-use constraint bounds exposure.

Trust model: links are sent to people you trust. There is no admin approval queue between submission and the entry being eligible for display — the `enabled=false` preset is the manual-review escape hatch when needed.

## Edge cases

- **Admin authenticated, visits `/g/<uuid>`**: sees the guest UI (URL is honored, identity is ignored). Useful for testing.
- **Multiple concurrent guests on the same link**: the link is single-use; whoever submits first consumes it. Others see "this link has already been used."
- **Submission size**: enforced client-side at 20 MB max for the original upload. Backend rejects oversized payloads.
- **File formats**: JPEG, PNG, WebP, HEIC accepted. GIF rejected (animation is meaningless on e-paper).
