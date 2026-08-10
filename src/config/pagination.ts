/**
 * How many rows one page of a listing renders.
 *
 * Both are 21 because both listings are the same three-column grid (`sm:grid-cols-2
 * lg:grid-cols-3`): 21 divides evenly by 3 and by 1, so a full page is never a short final row on
 * desktop or mobile. The file and image variants of the item-type page use the same number even
 * though they lay out differently — a page size that changed with the variant would make "page 3"
 * mean different items for two types.
 */
export const ITEMS_PER_PAGE = 21;
export const COLLECTIONS_PER_PAGE = 21;
