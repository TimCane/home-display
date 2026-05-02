# Step 19 — Draft modal + editor route

## Goal

Wire the "Create entry" modal (admin + guest variants) and the `/editor/<uuid>` route shell: load draft, run the auth gate, pick an editor variant by viewport, share commit-time plumbing. Editor body itself lands in steps 20-21.

## Depends on

Steps 14, 17, 18.

## Files

- `src/web/client/components/CreateEntryModal.tsx`
- `src/web/client/components/QrCode.tsx` — wrap a small QR lib
- `src/web/client/pages/Editor.tsx` — variant picker + auth handling
- `src/web/client/editor/EditorShell.tsx` — title input + commit button + draft state
- `src/web/client/editor/desktop/DesktopEditor.tsx` (placeholder for step 20)
- `src/web/client/editor/mobile/MobileEditor.tsx` (placeholder for step 21)
- `src/web/client/editor/useViewport.ts` — wide vs narrow

## Tasks

1. `CreateEntryModal`:
   - Fields per [entry-drafts.md § Modal fields](../entry-drafts.md#modal-fields). "Advanced" disclosure collapsed by default.
   - On save → `draft.create` → branch on `guest_mode`:
     - Guest: stay open with URL + QR + copy button.
     - Admin: close modal, `navigate(\`/editor/${id}\`)`.
   - Triggered by topbar `[+]` and "+ New entry" on entries list.
2. `QrCode`: tiny wrapper around `qrcode` or `qrcode.react`.
3. `Editor` page:
   - Read `:uuid` from route.
   - Call `draft.get(uuid)`.
   - Failure modes:
     - Missing/consumed/expired → render "this link is no longer valid."
     - Non-guest draft + no admin session → tRPC 401, redirect to `/api/auth/login?return=/editor/<uuid>`.
   - Success → render `EditorShell` with `{draft, variant: viewport === 'narrow' ? 'mobile' : 'desktop'}`.
4. `EditorShell`:
   - Title input (required, min length 1).
   - Commit button (disabled until title + valid frame).
   - Holds the *frame buffer source of truth* state shape that the editor variants will populate (e.g. a getter `getFrameBytes() => Uint8Array`).
   - On commit:
     - Render frame to bytes via shared `dither` + `encode2bpp`.
     - POST raw bytes to the commit endpoint from step 14, then call `draft.commit({title})` (or whichever wire format that step picked).
     - On success → for guest: show "thanks!" terminal page. For admin: navigate to `/entries`.
5. `useViewport`: simple `matchMedia('(min-width: 900px)')` hook.

## Acceptance

- Topbar `[+]` opens modal; admin path auto-navigates to the editor; guest path shows URL + QR.
- Visiting an expired/consumed UUID shows the "no longer valid" page, not the editor.
- Visiting a non-guest UUID without admin session bounces to login and returns afterwards.
- Resizing the viewport across the breakpoint swaps editor variants.

## Notes

- The actual canvas + tools are in 20/21. This step is the plumbing around them.
- See [editor.md § Render-from-framebuffer](../editor.md#render-from-framebuffer-admin-current-display-view) for any reverse-decode you might need (e.g. previewing the just-committed frame on the success screen).
