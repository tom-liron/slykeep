# Favorites Page

## Overview

Add a /favorites page displaying all favorited items and collections in a compact, dev-focused list.

## Requirements

- Build the favorite toggles, which do not exist yet: `toggleItemFavorite` and
  `toggleCollectionFavorite` Server Actions in `src/actions/`, each checking ownership before it
  writes, then wire them to the drawer's star (currently `disabled title="Coming soon"`) and the
  collection menu's "Add to favorites" (currently a "coming soon" toast). Without these the page is
  permanently empty for any account that wasn't seeded
- Add star icon button to TopBar linking to /favorites
- Create the page at `src/app/(dashboard)/favorites/page.tsx` — `proxy.ts` denies by default, so
  there is no per-route protection to add and no session check to write in the page
- Fetch the user's favorited items and collections through the server-only query modules
  (`src/server/items.ts`, `src/server/collections.ts`), returning view models — never Prisma records
- Compact list view (VS Code/terminal style, not cards)
- Each row: type icon, title, type badge, date added
- Separate sections for items and collections with counts
- Click item opens `ItemDrawer`, click collection navigates to /collections/[id]. The drawer does
  not open itself — it takes `{ item, open, onClose }` and the open/selected state lives in the
  client wrapper `ItemList`, so the compact rows go in as a new `ItemList` variant rather than a
  second wrapper
- Empty state when no favorites — one for the page, not one per section
- Sort by `updatedAt` descending. There is no favorited-at timestamp: favoriting bumps `updatedAt`
  (Prisma `@updatedAt` on the toggle's write), so a newly favorited row does surface first — but so
  does any unrelated edit. This is "most recently touched", not a true favorite order

## Out of scope

- Per-section sort controls (Newest / Oldest / A–Z). Deferred: that is the next lesson in the
  course. This page ships with the fixed `updatedAt` sort above.

## UI Style

- Monospace or semi-monospace font
- Minimal padding, high density
- Subtle hover states
- No card *per row* and no dividers between rows — but each section sits on one `bg-card` surface,
  so the list reads as a single object and the hover band has something lighter to be than. Rows
  floating on the page background had no unity and left the hover as the only surface in the list
- The type badge and the date travel together at a fixed width, rather than being flung to the far
  edge by the title: on a wide screen the width of the row was becoming the gap
