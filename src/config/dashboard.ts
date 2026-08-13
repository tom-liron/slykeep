import { ITEM_TYPE_COLORS } from "./item-type-catalog";

/**
 * The dashboard's two list lengths. Unlike the page sizes in `config/pagination.ts` these are caps,
 * not windows: the dashboard is a summary with a "View all" link, so there is no page 2 to reach.
 *
 * There is deliberately no cap on the Pinned section. It is the same kind of list `/favorites` is —
 * one whose length the user sets themselves, one click at a time — and a cap on it hides something
 * that was explicitly asked for. These two grow on their own as you work, which is why they need
 * bounding and Pinned does not.
 */
export const DASHBOARD_COLLECTIONS_LIMIT = 6;
export const DASHBOARD_RECENT_ITEMS_LIMIT = 10;

/**
 * The card grid: one column on a phone, two from `sm`, three from `lg`. Every page that lays cards
 * out in a grid uses this — the dashboard's collections, `/collections`, a collection's items, and
 * an item type's listing.
 *
 * One string rather than four copies because of what the fourth class in it is doing. `grid-cols-1`
 * looks redundant beside a bare `grid` and is the opposite: with no explicit template, the single
 * column below `sm` is an *implicit* track, and an implicit track is sized `auto` — which resolves
 * to max-content and is under no obligation to fit its container. Measured at 414px it came out at
 * 387.18px inside a 382px content box, so every card ran ~5px past the edge and the dashboard's
 * scroll container grew a horizontal scrollbar. `grid-cols-1` is `repeat(1, minmax(0, 1fr))`, whose
 * `0` floor is what makes the track give way instead. The two wide breakpoints were never affected,
 * because they name their columns.
 *
 * That is not a thing to rediscover four times, and it is why the class list is here rather than
 * inline: the next page that needs a card grid gets the fix by using it.
 */
export const CARD_GRID = "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3";

export const DASHBOARD_STAT_COLORS = {
    items: ITEM_TYPE_COLORS.snippet,
    collections: ITEM_TYPE_COLORS.link,
    favoriteItems: ITEM_TYPE_COLORS.note,
    favoriteCollections: ITEM_TYPE_COLORS.prompt,
} as const;
