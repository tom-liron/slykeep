# Global Search / Command Palette

## Overview

Add a global command palette (Cmd+K / Ctrl+K) with fuzzy search across items and collections.

## Requirements

- Open with Cmd+K (Mac) / Ctrl+K (Windows)
- Fuzzy search across all items and collections
- Grouped results: Items section, Collections section
- Keyboard navigation (arrow keys, Enter to select)
- Show item type icon (`TypeIcon`) and collection item count (`CollectionViewModel.itemCount`)
- Selecting a collection navigates to `/collections/[id]`
- Selecting an item opens the existing `ItemDrawer`, rendered by the palette itself — there is no
  item route and no URL that opens the drawer; today it is rendered only from local state in
  `src/components/items/ItemList.tsx`, so the palette owns its own instance the same way that list
  does
- The TopBar search input opens the palette on click. It is currently `disabled` with the
  placeholder "Search coming soon" and a matching `aria-label` — all three change
- Show ⌘K hint in search input placeholder

## Technical

- Use the shadcn `Command` component. It is **not** installed yet: `cmdk` is not a dependency and
  there is no `src/components/ui/command.tsx` — add it with `npx shadcn@latest add command`
- Client-side fuzzy search (no server round-trips)
- Pre-fetch searchable data in `src/app/(dashboard)/layout.tsx`, which already fetches the sidebar's
  data, and hand it to the palette
- Search data: items as `ItemSummaryViewModel` (id, title, description, tags, itemType), collections
  as `CollectionViewModel` (id, name, itemCount). **No content preview** — list view models must not
  select item bodies (`context/project-overview.md` §5), and the summary's title, description, and
  tags are enough to match on
- No existing query returns everything searchable: `getDashboardItems()` is pinned + recent and
  `getItemTypePageData()` is per-type, both in `src/server/items.ts`. `getCollections()` in
  `src/server/collections.ts` does return all of them with counts. Add the item side as a new query
  in `src/server/search.ts` (already listed `(planned)` in `context/project-overview.md` §9)
