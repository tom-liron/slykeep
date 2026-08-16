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
 * The card grid: one column, two once there is room for two, three once there is room for three.
 * Every page that lays cards out in a grid uses this — the dashboard's collections, `/collections`,
 * a collection's items, and an item type's listing.
 *
 * The stops are container queries against `@container/app`, the `main` element of the dashboard
 * layout, and not viewport breakpoints. A viewport breakpoint cannot answer the question a grid is
 * actually asking. `sm:grid-cols-2` means "the window is 640px", from which the grid has to *infer*
 * its own width by subtracting whatever chrome it believes is present — and it believes wrong twice:
 * it has to assume the 256px rail is there even when it is not, which held the third column back
 * until the window hit 1024px although it fitted at 768; and it cannot see the rail being collapsed
 * at all, so the 256px that toggle hands back went to nobody. An inline-size query measures the
 * content box this grid is laid out in, which is the number it needed in the first place.
 *
 * `560` and `704` are the widths at which a column stops being embarrassing, taken from the tightest
 * arrangement the viewport rule ever produced and kept: three columns across 704px is 224px each,
 * which is exactly what `lg:grid-cols-3` was already doing at a 1024px window with the rail out.
 *
 * `grid-cols-1` looks redundant beside a bare `grid` and is the opposite: with no explicit template
 * the single column is an *implicit* track, and an implicit track is sized `auto` — which resolves
 * to max-content and is under no obligation to fit its container. Measured at 414px it came out at
 * 387.18px inside a 382px content box, so every card ran ~5px past the edge and the page grew a
 * horizontal scrollbar. `grid-cols-1` is `repeat(1, minmax(0, 1fr))`, whose `0` floor is what makes
 * the track give way instead. The wider stops were never affected, because they name their columns.
 *
 * That is not a thing to rediscover four times, and it is why the class list is here rather than
 * inline: the next page that needs a card grid gets both fixes by using it.
 */
export const CARD_GRID =
    "grid grid-cols-1 gap-4 @min-[560px]/app:grid-cols-2 @min-[704px]/app:grid-cols-3";

export const DASHBOARD_STAT_COLORS = {
    items: ITEM_TYPE_COLORS.snippet,
    collections: ITEM_TYPE_COLORS.link,
    favoriteItems: ITEM_TYPE_COLORS.note,
    favoriteCollections: ITEM_TYPE_COLORS.prompt,
} as const;
