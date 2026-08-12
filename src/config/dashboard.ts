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

export const DASHBOARD_STAT_COLORS = {
    items: ITEM_TYPE_COLORS.snippet,
    collections: ITEM_TYPE_COLORS.link,
    favoriteItems: ITEM_TYPE_COLORS.note,
    favoriteCollections: ITEM_TYPE_COLORS.prompt,
} as const;
