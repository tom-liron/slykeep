/**
 * Page size for the application's paginated listings: an item type's items, the collections index,
 * and the items inside one collection.
 *
 * `server/items.ts` and `server/collections.ts` apply these as the `take` of those queries and derive
 * from them the page count the `Pagination` control renders.
 *
 * @remarks
 * Both listings lay out in `CARD_GRID`, which is one, two or three columns wide; 21 divides by one
 * and by three, so a full page ends on a complete row in the narrowest and widest arrangements.
 * {@link COLLECTIONS_PER_PAGE} holds the same number for the same reason. The
 * item-type page's file variant keeps the same size despite laying out as rows — a page size that
 * varied by variant would make "page 3" mean different items for different types.
 */
export const ITEMS_PER_PAGE = 21;
export const COLLECTIONS_PER_PAGE = 21;
