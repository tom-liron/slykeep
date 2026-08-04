# Current Feature: Item Drawer — Edit Mode

## Feature

Spec: `context/features/item-drawer-edit-spec.md`

The pencil button in the item drawer's action bar — inert since the drawer shipped — switches the
open drawer from view mode into edit mode inline. Fields become controlled inputs, the action bar
becomes Save / Cancel, and Save writes through a new Server Action.

## Status

In Progress

## Goals

- Edit toggles the open drawer into edit mode inline; no navigation, no second drawer
- In edit mode the action bar is replaced by Save and Cancel; Cancel discards and returns to view mode
- Save persists via Server Action, returns to view mode, refreshes the drawer's data, and toasts the
  outcome (success or error)
- Editable for every type: title (required), description (optional), tags (comma-separated input,
  converted to an array on save)
- Type-specific fields, shown only for the types that have them:
    - content (textarea) — snippet, prompt, command, note
    - language (text) — snippet, command
    - url (text) — link
- Item type, collections, and created/updated dates render read-only in edit mode
- `updateItem(itemId, data)` in `src/actions/items.ts`, returning `{ success, data, error }`:
  validates with Zod, resolves the user via `getCurrentUserId()`, enforces ownership, writes
- Zod is the server-side source of truth: title non-empty and trimmed; description / content /
  language nullable optional; url a valid URL or null; tags an array of trimmed non-empty strings
- Zod errors come back in `{ success: false, error }` so the client can display them
- Tags reconcile on write: disconnect all existing, connect-or-create the new set
- The action returns the updated `ItemDetailViewModel`, so the drawer refreshes without a second fetch
- `router.refresh()` after save, so the card list behind the drawer reflects the change

## Notes

**Spec corrections applied by `/project-sync` at load** — the spec was written against the course's
structure, and three claims were wrong for this codebase:

- `lib/db/items.ts` → `src/server/items.ts` does not receive this at all (see below); `src/lib/db/`
  has never existed here
- `ItemDetail` → the real type is `ItemDetailViewModel` (`src/types/view-models.ts:42`)
- `auth()` → our actions resolve the user through `getCurrentUserId()` from `@/server/current-user`,
  as `src/actions/account.ts` does

**Where the write lives.** Decided at load: the action calls `prisma` directly, matching every
existing write in `src/actions/account.ts`. `src/server/items.ts` stays read-only, which is what
`context/project-overview.md` §9 says the split is — `server/` owns reads, `actions/` owns writes.
The spec originally routed the write through a query function; that was the course's shape.

**Ownership belongs in the `where`.** `getItemDetail` puts `userId` in the `where` clause rather
than checking the returned row, so another user's id is indistinguishable from a missing one, and
`src/server/items.test.ts` pins that. The update should follow the same rule.

**Scope boundaries.** Only the pencil button becomes live. The rest of the action bar (favourite,
pin, delete) stays inert — those are separate mutations. No form library, no code editor for the
content textarea (Phase 3 owns syntax highlighting), and collections stay unmanaged here.

**Client-side guard.** Disable Save while the title is empty. That is UX only; Zod on the server
remains the actual validation.

**Toasts** are colored by outcome via sonner's `richColors` on the single `<Toaster>` — don't style
per call site (`context/coding-standards.md`).

## History

Moved to `context/feature-history.md`, which is **not** `@`-imported — this file is loaded into
every session and the history is not needed in most of them. `/feature complete` appends there.
