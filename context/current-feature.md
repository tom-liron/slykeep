# Current Feature

Source structure cleanup — remove legacy directories and make type, config, server, and React module ownership explicit.

## Status

Completed

## Goals

- Remove empty legacy directories without weakening the `(dashboard)` route-group architecture.
- Separate item-type contracts, UI view models, and runtime configuration.
- Use consistent names for React context and server view-model modules.
- Validate every mock item-type reference against the canonical system configuration.
- Keep the project tree minimal; do not scaffold empty future layers.

## Notes

- `(dashboard)` is intentional Next.js syntax: it shares the app shell without adding a URL segment.
- Route loading, error, not-found, metadata, and legacy redirect handling are deferred to a dedicated production-hardening pass.
- Prisma, authentication, and mutations remain deferred.

## History

- **Project foundation** (`6a86eb6`) — Scaffolded the initial Next.js setup: stripped the create-next-app boilerplate, added `CLAUDE.md` with commands and project context, and set up the `context/` docs folder.
- **Dashboard UI Phase 1** (`feature/dashboard-phase-1`) — Initialized shadcn/ui (radix / nova preset), installed button + input, enabled dark mode by default, and scaffolded the `/dashboard` route: sidebar shell with the DevStash brand header, a display-only top bar (search + New Collection/New Item), and placeholder "Sidebar"/"Main" areas.
- **Dashboard UI Phase 2** (`feature/dashboard-phase-2`) — Built the functional collapsible sidebar: item types linking to `/items/[type]` (colored icons + counts), favorite and recent collections sections, and a user avatar area with settings link. Moved the DevStash brand out of the sidebar into a full-width top bar so it stays visible when the rail is collapsed and on mobile. Added a mobile slide-out drawer (hamburger to open, X/backdrop/Escape to close, body scroll lock) and made the top bar responsive across all breakpoints.
- **Dashboard UI Phase 3** (`feature/dashboard-phase-3`) — Built out the main content area to the right of the sidebar: four stats cards at the top (total items, collections, favorite items, favorite collections), a recent collections row, a pinned items section, and a grid of the 10 most recent items. Added `CollectionCard`, `ItemCard`, and `StatCard`; its original client-accessible mock helper was later replaced by the server-only query layer.
- **Professional architecture refactor** — Moved the dashboard to the root `(dashboard)` route group, introduced server-only mock queries and explicit view models, added read-only item and collection routes, made collection metadata fully derived, and replaced the custom mobile overlay with an accessible Radix dialog.
- **Source structure cleanup** — Removed empty legacy directories, separated type contracts from view models and runtime configuration, standardized server and React module names, and clarified runtime item-type catalog terminology.
