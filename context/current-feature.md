# Current Feature

## Feature

<!-- Feature Name and Short Description -->

## Status

<!-- Not Started | In Progress | Completed -->

## Goals

<!-- Goals and requirements -->

## Notes

<!-- Any extra notes -->

## History

> One line per feature, newest last. Durable rules belong in `context/project-overview.md`, not here.

1. **Project foundation** (`6a86eb6`) — Stripped the create-next-app boilerplate, added `CLAUDE.md`, set up the `context/` docs folder.
2. **Dashboard UI Phase 1** (`feature/dashboard-phase-1`) — shadcn/ui init, dark mode by default, and the `(dashboard)` route group shell: sidebar, top bar, placeholder main area.
3. **Dashboard UI Phase 2** (`feature/dashboard-phase-2`) — Functional collapsible sidebar (item types with counts, favorite + recent collections, user area). Moved the brand into a full-width top bar so it survives collapse.
4. **Dashboard UI Phase 3** (`feature/dashboard-phase-3`) — Main content area: four stat cards, recent collections row, pinned items, recent items grid. Added `CollectionCard`, `ItemCard`, `StatCard`.
5. **Professional architecture refactor** — Server-only mock queries and explicit view models, read-only item/collection routes, fully derived collection metadata, accessible Radix mobile dialog.
6. **Source structure cleanup** — Separated type contracts from view models and runtime config; standardized module names.
7. **Post-refactor polish** — `[type]` → `[slug]`, shared `EmptyState`, narrowed `SidebarItemTypeViewModel`, dropped dead fallbacks in favor of failing fast on unknown item types.
8. **Prisma readiness cleanup** — Split item list summaries from full content records, made server-only boundaries explicit, added Pro-access scaffolding.
9. **Item-type identity alignment** (`feature/item-type-identity-alignment`) — Split item-type *identity* (database) from *presentation* (config), keyed by natural name instead of hardcoded ids. Renamed `ContentKind` → `ContentType`, and split the overloaded item `content` field into real `content` / `url` / `fileUrl` / `fileName` / `fileSize` columns.
10. **Prisma + Neon foundation** (`feature/prisma-neon-foundation`) — Roadmap Phase 0. Prisma 7.8 on a Neon dev branch: schema, `init` migration, system-type seed, client singleton, and `npm run db:test` as a repeatable smoke test. Closed the system-type uniqueness hole with a schema-declared partial index (the `NULL`-distinctness trap and the `findUnique`-by-name bug are written up in `project-overview.md` §5).
11. **Development seed data** (`feature/seed-data`) — Seeded a demo user, five collections, and eighteen items. Idempotency is delete-then-recreate scoped to the demo user, since collections and items have no natural key to match on. `Item.contentType` is derived from the item type rather than hand-written, which makes a mismatch unrepresentable.
12. **Dashboard collections from the database** (`feature/dashboard-collections-db`) — Swapped the whole collection read path from mock to Prisma via `src/server/collections.ts`: dashboard cards + collection stats, `/collections`, `/collections/[id]`, and the sidebar lists. Had to move as a unit — a dashboard-only swap would have emitted database cuids into links the mock layer still resolved, 404ing every card. Built in `src/server/`, not the course's `src/lib/db/` (see CLAUDE.md → Course Mapping). Also caught that the dashboard was being statically prerendered, which would have baked the rows into the HTML at build time; fixed with `force-dynamic` on the layout. Items are still mock, so the cards sum to 18 while the Items stat card reads 16 until that swap lands.
13. **Dashboard items from the database** (`feature/dashboard-items-db`) — Swapped the dashboard's pinned + recent item lists and the two item stat cards from mock to Prisma via `src/server/items.ts`. Query-level splitting (`count()` for totals, scoped `findMany` for the lists) mirrors the collections module rather than loading every item to derive stats, and the summary select never touches item bodies. `ItemCard` links nowhere, so unlike the collections swap this moved on its own — the sidebar nav and `/items/[slug]` pages stay mock. Fixes the Items stat that read 16 against mock while the cards summed to 18 (see #12); it now reads 18. Removed the obsolete `buildDashboardItemsViewModel` and its test.
