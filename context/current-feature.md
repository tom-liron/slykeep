# Current Feature

Dashboard UI Phase 3 — build out the main content area to the right of the sidebar. Phase 3 of 3 for the dashboard UI layout. Full spec: @context/features/dashboard-phase-3-spec.md

## Status

In Progress

## Goals

- The main content area to the right of the sidebar
- Recent collections
- Pinned items
- 10 recent items
- 4 stats cards at the top: total items, collections, favorite items, favorite collections (not in the screenshot)

## Notes

- Use the reference screenshot for layout: @context/screenshots/dashboard-ui-main.png
- Pull data from the mock data file for now — import directly until the database is in place: @src/lib/mock-data.ts
- Related specs: @context/features/dashboard-phase-1-spec.md, @context/features/dashboard-phase-2-spec.md

## History

- **Project foundation** (`6a86eb6`) — Scaffolded the initial Next.js setup: stripped the create-next-app boilerplate, added `CLAUDE.md` with commands and project context, and set up the `context/` docs folder.
- **Dashboard UI Phase 1** (`feature/dashboard-phase-1`) — Initialized shadcn/ui (radix / nova preset), installed button + input, enabled dark mode by default, and scaffolded the `/dashboard` route: sidebar shell with the DevStash brand header, a display-only top bar (search + New Collection/New Item), and placeholder "Sidebar"/"Main" areas.
- **Dashboard UI Phase 2** (`feature/dashboard-phase-2`) — Built the functional collapsible sidebar: item types linking to `/items/[type]` (colored icons + counts), favorite and recent collections sections, and a user avatar area with settings link. Moved the DevStash brand out of the sidebar into a full-width top bar so it stays visible when the rail is collapsed and on mobile. Added a mobile slide-out drawer (hamburger to open, X/backdrop/Escape to close, body scroll lock) and made the top bar responsive across all breakpoints.
