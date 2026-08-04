# Item Drawer

## Overview

Right-side slide-in drawer that opens when clicking an item card. This is the item detail view — there is no separate item page.

## Requirements

- Use the shadcn Sheet component, opens from the right — add it as `src/components/ui/sheet.tsx` via the shadcn CLI (not yet installed)
- Clicking an `ItemCard` opens the drawer with that item's full data
- Works on both dashboard and items list pages
- Action bar with Favorite (star icon, yellow when active), Pin, Copy, Edit (pencil icon), and Delete (trash icon, right-aligned) — see screenshot for layout
- The extras like the code editor and item-specific stuff will come later. For now, let's just work on the drawer details display.
- The drawer and the client wrapper that owns its open/selected state live in `src/components/items/` (PascalCase files); pages stay server components
- Should feel snappy — fetch on click, no page navigation

## Data Fetching

- Card data (`ItemSummaryViewModel`) is fetched by the server component as before
- Full item detail (content, collections, tags, etc.) is fetched on click via a route handler at `src/app/api/items/[id]/route.ts` — a route rather than a Server Action because the client needs to distinguish 404 from 500
- The query lives in `src/server/items.ts` and returns a new `ItemDetailViewModel` (declared in `src/types/view-models.ts`, built through `src/server/view-models.ts`) — the drawer must not receive Prisma records
- The route resolves the signed-in user with `getCurrentUser()` and the query scopes by `userId`, so another user's id returns 404
- Drawer shows a skeleton/loading state while fetching

## Reference

See `context/screenshots/dashboard-ui-drawer.png` for the visual design.
