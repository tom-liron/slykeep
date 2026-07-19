# Stats & Sidebar Spec

## Overview

Move the remaining sidebar reads off the mock query layer (@src/server/mock-data/) and onto the
database, matching what the dashboard stats and the sidebar collections already do.

The main-area stats and the sidebar collection lists are already database-backed (see Already Done
below); this spec is now scoped to the sidebar's item-type list, a "View all collections" link, and
the recent-collection dominant-type indicator.

## Already Done

- **Dashboard stats** read from the database. @src/app/(dashboard)/page.tsx builds all four stat
  cards from `getDashboardCollections()` and `getDashboardItems()` (Prisma), keeping the existing
  layout.
- **Sidebar collections** read from the database via `getSidebarCollections()` in
  @src/server/collections.ts — favorites and recent non-favorites.
- **Sidebar item types** already render with their icons and link to `/items/[slug]`, and favorite
  collections already show the star icon — see @src/components/layout/SidebarNav.tsx. The UI is in
  place; only the data source and the recents indicator still need work.

## Requirements (remaining)

- **Move the sidebar item types onto the database.** They are still mock-backed:
  @src/app/(dashboard)/layout.tsx sources them from `getSidebarNav()` in
  @src/server/mock-data/queries.ts. Add a database read (item-type list with per-type item counts
  for the signed-in user) and drop that half of `getSidebarNav()`. `getItemTypesById()` in
  @src/server/item-types.ts and `getDashboardItems()` in @src/server/items.ts are the closest
  references; per-type counts are new. Keep the existing `SidebarItemTypeViewModel` shape.
- **Add a "View all collections" link** under the sidebar collections list that goes to
  /collections. (The dashboard main area already has a "View all" link; the sidebar does not.)
- **Recent collections: colored dominant-type circle.** Favorites keep the star. Recents currently
  show the item count as text — replace that with a colored circle based on the most-used item type
  in the collection. This needs a `dominantItemType` (color) on `SidebarCollectionViewModel`, which
  the collection read path does not yet carry; `CollectionViewModel.dominantItemType` in
  @src/server/collections.ts already derives this for the cards and is the reference.

## References

- @src/server/collections.ts — DB read + dominant-type derivation
- @src/server/items.ts — dashboard item stats, the pattern to follow
- @src/components/layout/SidebarNav.tsx — sidebar UI to wire up
