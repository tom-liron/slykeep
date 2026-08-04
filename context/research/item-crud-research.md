# Item CRUD Architecture

## Output

`docs/item-crud-architecture.md`

## Research

Design a unified CRUD system for all 7 system item types, following this project's structure — not
the course's:

- Mutations as Server Actions in `src/actions/items.ts`, with Zod input contracts in `src/lib/`
- Reads in the server-only query module `src/server/items.ts`, called directly from server
  components, returning view models (never Prisma records)
- One dynamic route, `/items/[slug]`, plus shared components that adapt by type

## Include

- File structure: `actions/` for writes, `server/` for reads and view-model preparation,
  `app/(dashboard)/items/[slug]/` for the route, `components/items/` for UI
- How `/items/[slug]` routing works: the URL segment is the **plural route slug**
  (`snippets`, `links`, …), resolved to the persisted singular `ItemTypeName` via
  `getItemTypeNameBySlug()`; `notFound()` on an unknown slug
- Where type-specific logic lives: presentation in components, driven by
  `ITEM_TYPE_CATALOG` (label, icon, color, slug, `contentType`, `isPro`) — actions stay generic
- The write boundary's responsibilities, since the schema does not enforce them:
    - `Item.contentType` is denormalized against its `ItemType` — validate it matches the catalog
    - which of `content` / `url` / `fileUrl` must be populated per content type
    - ownership (`userId` from `getCurrentUserId()`), never trusted from the client
    - entitlement via `canAccessItemType()` (`src/lib/limits.ts`)
    - never `findUnique` an item type by `name` alone — use
      `findFirst({ where: { name, userId: null } })`
- Which mutations (if any) need to be route handlers instead of actions, per the project rule:
  an action when the caller only needs success or a message, a route handler when it needs an
  HTTP status
- Component responsibilities: the quick-access drawer (view / edit / create), the shared form and
  how it swaps its body editor by `contentType`, and `ItemCard` / `TypeIcon` reuse
- Revalidation: which paths each mutation invalidates (`/`, `/items/[slug]`, collection pages)

## Sources

- @context/project-overview.md
- @context/coding-standards.md
- @prisma/schema.prisma
- @src/config/item-type-catalog.ts
- @src/types/item-type.ts
- @src/types/view-models.ts
- @src/server/items.ts
- @src/server/view-models.ts
- @src/actions/account.ts — the existing Server Action pattern to follow
- @src/components/items/ItemCard.tsx
- `docs/item-types.md`, if the item-types research has already produced it
