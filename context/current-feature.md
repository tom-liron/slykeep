# Current Feature: Delete Item

## Feature

Delete an item from the detail drawer. The Delete button in the drawer's action bar — currently
disabled, layout only — becomes live: it opens a shadcn/ui `AlertDialog` confirmation, and on
confirm the item is deleted, the drawer closes, the list behind refreshes, and a success toast
fires.

## Status

In Progress

## Goals

- `deleteItem(itemId)` Server Action in `src/actions/items.ts`, alongside `updateItem`, with
  ownership pinned in the Prisma `where` (`{ id, userId }`) rather than checked after the read, and
  `P2025` mapped to "This item no longer exists."
- A `DeleteItemResult` in `src/types/item.ts` following the existing discriminated-union pattern
  (`{ success: true }` | `{ success: false; error: string }`).
- A confirmation step built on the existing `src/components/ui/alert-dialog.tsx` primitives,
  following `src/components/profile/DeleteAccountDialog.tsx` — names the item being deleted, says
  the action cannot be undone, destructive-styled confirm, pending state while the action runs.
- The drawer's Delete button (`ItemDrawer.tsx`, currently `disabled title="Coming soon"`) triggers
  it; on success the drawer closes and `router.refresh()` updates the list behind it.
- `toast.success` on success, `toast.error` with the action's message on failure — sonner, matching
  `ItemEditForm`'s handling.
- Focused unit tests in `src/actions/items.test.ts` covering the ownership filter, the not-found
  path, and the success path.

## Notes

- Scope is the drawer only. The card's own affordances, bulk delete, and a trash/undo view are not
  part of this — soft vs hard delete is still an open question in `project-overview.md` §11, so this
  is a hard delete.
- Action, not a route handler: the caller needs the outcome and a message, never an HTTP status
  (`coding-standards.md`, and the reasoning already written into `updateItem`).
- Writes live in `actions/`; `server/items.ts` stays read-only.
- `ItemDrawer` is keyed by item id in `ItemList` and `onClose` only flips `open` — the deleted item
  stays in `selected` until the list re-renders, so the close path must not re-fetch the gone item.
- Prisma relations: `ItemCollection` rows referencing the item, and the implicit `Item`↔`Tag` join,
  have to come off with it — verify the schema's cascade behaviour rather than assuming it, and
  delete explicitly in a transaction if it does not cascade.
- No browser verification expected; a passing build plus the unit tests is the evidence. A CRUD
  round trip is worth a manual look once merged.

## History

Moved to `context/feature-history.md`, which is **not** `@`-imported — this file is loaded into
every session and the history is not needed in most of them. `/feature complete` appends there.
