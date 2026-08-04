# Current Feature: Item Drawer

## Feature

A right-side slide-in drawer that opens when an item card is clicked, showing the item's full
detail. This is the item detail view — there is no separate item page. Spec:
`context/features/item-drawer-spec.md`.

## Status

In Progress

## Goals

- The shadcn Sheet primitive is added as `src/components/ui/sheet.tsx` via the shadcn CLI, opening from the right
- Clicking an `ItemCard` opens the drawer with that item's full data, on both the dashboard and the item-type list pages
- A client wrapper in `src/components/items/` owns the open/selected state, so the pages stay server components
- Detail is fetched on click from a route handler at `src/app/api/items/[id]/route.ts` — no page navigation
- The query lives in `src/server/items.ts` and returns a new `ItemDetailViewModel`, declared in `src/types/view-models.ts` and built through `src/server/view-models.ts`; no Prisma record reaches the drawer
- The route resolves the signed-in user and the query scopes by `userId`, so another user's item id returns 404
- The drawer shows a skeleton while the fetch is in flight
- The action bar renders Favorite (star, yellow when active), Pin, Copy, Edit (pencil), and Delete (trash, right-aligned), laid out as in the screenshot

## Notes

Scope is the **detail display only**. The markdown/code editor and the per-type content rendering
come later — the action bar's buttons are part of this feature's layout, but wiring them to
mutations is not.

Card data stays as it is: the server components already fetch `ItemSummaryViewModel`, and only the
full detail (content, collections, tags) is fetched on click.

A route handler rather than a Server Action, because the client needs to tell 404 from 500 — the
same rule that made `api/auth/register` a route.

Open question for implementation: `src/server/current-user.ts` exports both `getCurrentUser()`
(returns a full `UserViewModel`) and `getCurrentUserId()`. The route only needs the id to scope the
query, so `getCurrentUserId()` is likely the better fit; the spec names `getCurrentUser()`.

Reference: `context/screenshots/dashboard-ui-drawer.png`.

## History

Moved to `context/feature-history.md`, which is **not** `@`-imported — this file is loaded into
every session and the history is not needed in most of them. `/feature complete` appends there.
