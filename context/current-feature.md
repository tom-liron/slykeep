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

- **Project foundation** (`6a86eb6`) — Scaffolded the initial Next.js setup: stripped the create-next-app boilerplate, added `CLAUDE.md` with commands and project context, and set up the `context/` docs folder.
- **Dashboard UI Phase 1** (`feature/dashboard-phase-1`) — Initialized shadcn/ui (radix / nova preset), installed button + input, enabled dark mode by default, and scaffolded the `/` dashboard through the `(dashboard)` route group: sidebar shell with the DevStash brand header, a display-only top bar (search + New Collection/New Item), and placeholder "Sidebar"/"Main" areas.
- **Dashboard UI Phase 2** (`feature/dashboard-phase-2`) — Built the functional collapsible sidebar: item types linking to `/items/[slug]` (colored icons + counts), favorite and recent collections sections, and a user avatar area with a disabled settings control. Moved the DevStash brand out of the sidebar into a full-width top bar so it stays visible when the rail is collapsed and on mobile. The initial mobile drawer was later replaced by an accessible Radix dialog.
- **Dashboard UI Phase 3** (`feature/dashboard-phase-3`) — Built out the main content area to the right of the sidebar: four stats cards at the top (total items, collections, favorite items, favorite collections), a recent collections row, a pinned items section, and a grid of the 10 most recent items. Added `CollectionCard`, `ItemCard`, and `StatCard`; its original client-accessible mock helper was later replaced by the server-only query layer.
- **Professional architecture refactor** — Moved the dashboard to the root `(dashboard)` route group, introduced server-only mock queries and explicit view models, added read-only item and collection routes, made collection metadata fully derived, and replaced the custom mobile overlay with an accessible Radix dialog.
- **Source structure cleanup** — Removed empty legacy directories, separated type contracts from view models and runtime configuration, standardized server and React module names, and clarified runtime item-type catalog terminology.
- **Post-refactor polish** — Renamed the items route param `[type]` → `[slug]`, extracted a shared `EmptyState` UI component, reworked `withAlpha` to take a 0–1 opacity, narrowed `SidebarItemTypeViewModel` to only the fields the sidebar uses, and dropped unused helpers/fallbacks (`resolveIconName`, `FALLBACK_TYPE_COLOR`) in favor of failing fast on unknown item types.
- **Prisma readiness cleanup** — Split item list summaries from full content records, made server-only module boundaries explicit, clarified recent-collection view-model names, added centralized Pro-access scaffolding, completed small accessibility/test improvements, and reconciled the Prisma draft with the runtime item-type model.
