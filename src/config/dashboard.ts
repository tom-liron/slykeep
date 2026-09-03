import { ITEM_TYPE_COLORS } from "./item-type-catalog";

/**
 * Presentation values that more than one signed-in surface has to agree on.
 *
 * The file holds three unrelated groups, because what admits a value is "shared across the
 * authenticated area" rather than a single subject. Each group is consumed from a different layer:
 *
 * - **Summary limits** ({@link SIDEBAR_RECENT_COLLECTIONS_LIMIT},
 *   {@link DASHBOARD_COLLECTIONS_LIMIT}, {@link DASHBOARD_RECENT_ITEMS_LIMIT}) —
 *   `getDashboardCollections`, `getDashboardItems` and `getSidebarCollections` in `server/` apply
 *   them as the `take` of their Prisma queries.
 * - **Grid class lists** ({@link CARD_GRID}, {@link FILE_ROW_GRID}) — the dashboard,
 *   `/collections`, a collection's page and the item-type listings hand them to `ItemList` and
 *   their collection grids, so every page that lays content out answers to the width of the main
 *   area the same way.
 * - **Stat colours** ({@link DASHBOARD_STAT_COLORS}) — the four summary cards on the dashboard,
 *   and the two on the profile page.
 *
 * A value earns its place here once a second signed-in surface needs it. One with a single consumer
 * belongs beside that consumer.
 */

/** How many non-favourite collections the sidebar's recent list shows. */
export const SIDEBAR_RECENT_COLLECTIONS_LIMIT = 5;

/**
 * How many collections and how many recent items the dashboard's summary sections show.
 *
 * @remarks
 * These are caps on a summary, so what they leave out is reached through the section's "View all"
 * link. That makes them a different kind of number from the page sizes in `config/pagination.ts`,
 * which window a listing the reader can page through. The dashboard's pinned section takes no cap at
 * all — its length is set by the user, one pin at a time.
 */
export const DASHBOARD_COLLECTIONS_LIMIT = 6;
export const DASHBOARD_RECENT_ITEMS_LIMIT = 10;

/**
 * The card grid every page that lays out cards shares — the dashboard's collections,
 * `/collections`, a collection's items, and the item-type listings, each passing it to `ItemList`
 * as a class name.
 *
 * @remarks
 * The stops are container queries against `@container/app`, the dashboard layout's `main` element,
 * rather than viewport breakpoints: the sidebar collapses, so the width of the window does not tell
 * this grid how much room it has.
 *
 * Keep `grid-cols-1` — it stops wide card content forcing the grid past its container.
 */
export const CARD_GRID =
    "grid grid-cols-1 gap-4 @min-[560px]/app:grid-cols-2 @min-[704px]/app:grid-cols-3";

/**
 * The grid for the file and image listings, which render rows rather than cards. The item-type page
 * picks this over `CARD_GRID` for its file variant.
 *
 * @remarks
 * Two columns where `CARD_GRID` reaches three, and at a wider stop. A row arranges icon, title,
 * filename, size, date and download horizontally, so it needs roughly twice a card's width before
 * its title has any room left. `grid-cols-1` matters here for the same reason it does in
 * {@link CARD_GRID}.
 */
export const FILE_ROW_GRID = "grid grid-cols-1 gap-2 @min-[860px]/app:grid-cols-2";

/**
 * Accent colours for the summary cards: all four on the dashboard, and the item and collection
 * totals repeated on the profile page. Drawn from {@link ITEM_TYPE_COLORS}, so a count is tinted
 * like the things it counts.
 */
export const DASHBOARD_STAT_COLORS = {
    items: ITEM_TYPE_COLORS.snippet,
    collections: ITEM_TYPE_COLORS.link,
    favoriteItems: ITEM_TYPE_COLORS.note,
    favoriteCollections: ITEM_TYPE_COLORS.prompt,
} as const;
