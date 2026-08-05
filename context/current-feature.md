# Current Feature: Item Create

## Feature

Create new items from a modal dialog, opened by the "New Item" button in the top bar. Spec:
`context/features/item-create-spec.md`.

## Status

In Progress

## Goals

- Install the shadcn Dialog component (`npx shadcn@latest add dialog`) — `src/components/ui/` has
  `alert-dialog` and `sheet`, but no `dialog`.
- Enable the "New Item" button in `src/components/layout/TopBar.tsx` (currently `disabled` with a
  "coming soon" title) and have it open the create dialog.
- Type selector covering the five non-Pro system types: snippet, prompt, command, note, link.
- Fields render per selected type:
  - all types — title (required), description, tags
  - snippet / command — content, language
  - prompt / note — content
  - link — url (required)
- `createItem` Server Action in `src/actions/items.ts`, validated by a Zod schema in
  `src/lib/item-schemas.ts` beside `updateItemSchema`. The Prisma write lives in the action.
- Success toast, dialog closes, list refreshes.

## Notes

- **Create is a Dialog, view/edit stays a Sheet.** `project-overview.md` §8 describes one slide-out
  drawer for view/edit/create, and `ItemDrawer` shipped as a Sheet. Keeping the modal for create is
  a deliberate divergence, confirmed at load time — not an oversight to reconcile later.
- **No query function.** The spec originally asked for `createItem` in `lib/db/items.ts`; that is
  the course's layout. `src/server/` is read-only here, and `updateItem` / `deleteItem` both put the
  Prisma write directly in the Server Action. Follow that.
- **Set `contentType` from the type, never from the payload.** It is denormalized against
  `ItemType` and enforced at the write boundary: TEXT for snippet/prompt/command/note, URL for link.
  It also discriminates which of `content` / `url` / `fileUrl` is populated.
- **Never `findUnique` an item type by `name` alone** — use
  `findFirst({ where: { name, userId: null } })` to resolve the selected type to its id.
- **Ownership on the write.** `userId` comes from `getCurrentUser()`, never the form.
- **Tags** follow the edit form's pattern: `createMany({ skipDuplicates })` then `set`.
- **Absent vs empty**, as established in the edit form: submit only the fields the selected type
  owns, so a snippet's payload has no `url` key. `undefined` means "don't write", `""` means "clear".
- Only the five non-Pro types are offered; `file` and `image` need R2 uploads (Phase 4).

## History

Moved to `context/feature-history.md`, which is **not** `@`-imported — this file is loaded into
every session and the history is not needed in most of them. `/feature complete` appends there.
