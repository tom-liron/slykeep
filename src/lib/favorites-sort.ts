import type { FavoriteCollectionViewModel, ItemSummaryViewModel } from "@/types/view-models";

/**
 * The client-side sort behind `/favorites`.
 *
 * The page receives both starred lists already ordered newest-first (`id desc` breaks ties), which
 * is the only order the server offers. Re-ordering by name or type is a preference over rows already
 * in memory, not a query — `FavoritesSortControl` sets the {@link FavoriteSort} and `FavoritesView`
 * calls {@link sortFavorites}. Items and collections use one comparator: each shape projects to
 * {@link FavoriteSortFields} through {@link itemSortFields} or {@link collectionSortFields}, and
 * {@link compareFavorites} sees only that.
 */

/** The three keys a favourite list can be ordered by. */
export type FavoriteSortKey = "name" | "date" | "type";

export type SortDirection = "asc" | "desc";

export interface FavoriteSort {
    key: FavoriteSortKey;
    direction: SortDirection;
}

/**
 * Everything the comparator is allowed to look at, whatever row it came from.
 *
 * `typeLabel` is nullable because a collection with no items and no `defaultTypeId` has no dominant
 * type. An item's type is never null, so that branch only fires on the collections list — it stays
 * in the shared comparator rather than becoming a special case there, so both sections keep one
 * rule.
 */
export interface FavoriteSortFields {
    /** What the row is called: an item's title, a collection's name. */
    label: string;
    /**
     * The date the row renders, which is a different column on each side: an item's `editedAt` (when
     * its content last changed) and a collection's `updatedAt`. Named for its use rather than after
     * either column, so neither side has to pretend to be the other.
     *
     * ISO 8601, UTC, as both view models serialize it. Compared as a string — see {@link byDateDesc}.
     */
    sortDate: string;
    /** The item type's display label, the only part of a type a user sees. Null when absent. */
    typeLabel: string | null;
    id: string;
}

/**
 * The direction each key opens in. A date opens newest-first and a name opens A–Z, so there is no
 * single correct shared default. The control resets to these when the key changes rather than
 * carrying the previous direction across, which would land a date-to-name switch on Z–A.
 */
export const DEFAULT_SORT_DIRECTION: Record<FavoriteSortKey, SortDirection> = {
    name: "asc",
    date: "desc",
    type: "asc",
};

/** What the page renders on arrival: the order the server already returned, so nothing moves on hydration. */
export const DEFAULT_FAVORITE_SORT: FavoriteSort = { key: "date", direction: "desc" };

/**
 * Case-insensitive and digit-aware: `apiKey` and `APIKEY` tie, `item2` sorts before `item10`.
 * Punctuation still counts, so `API_KEY` is its own string. Built once — a collator per comparison
 * is the expensive part of this sort.
 */
const collator = new Intl.Collator(undefined, { sensitivity: "base", numeric: true });

/**
 * Newest first, then newest id — the order both server queries use.
 *
 * A string comparison rather than `Date.parse`: both view models build the field with
 * `toISOString()` — always UTC, always the same width — so lexicographic order is chronological.
 * That skips parsing two dates per comparison and makes this identical to what the database
 * returned rather than merely equivalent to it.
 */
function byDateDesc(left: FavoriteSortFields, right: FavoriteSortFields): number {
    if (left.sortDate !== right.sortDate) {
        return left.sortDate < right.sortDate ? 1 : -1;
    }

    return byIdDesc(left, right);
}

/** The last resort, and the only comparator that can return 0 — ids are unique, so only for a row against itself. */
function byIdDesc(left: FavoriteSortFields, right: FavoriteSortFields): number {
    if (left.id === right.id) {
        return 0;
    }

    return left.id < right.id ? 1 : -1;
}

/**
 * Orders two favourites under a {@link FavoriteSort}.
 *
 * A total order: every pair is decided, so the result never depends on the order the rows arrived
 * in, and the tests do not have to care either.
 *
 * @remarks
 * The tiebreak stays outside the direction flip — only the primary key reverses. A tiebreak that
 * reversed with it would reshuffle every equal-keyed row each time the arrow is toggled.
 *
 * The missing-type branch is answered before the flip multiplier is applied, so collections with no
 * dominant type sink to the bottom in both directions. Multiplied, "no type last" becomes "no type
 * first" when descending.
 */
export function compareFavorites(
    left: FavoriteSortFields,
    right: FavoriteSortFields,
    sort: FavoriteSort,
): number {
    const flip = sort.direction === "asc" ? 1 : -1;

    if (sort.key === "date") {
        // The date is the primary key here, so the tiebreak below it is `id desc` alone; running the
        // full byDateDesc would compare the same field a second time.
        if (left.sortDate !== right.sortDate) {
            return flip * (left.sortDate < right.sortDate ? -1 : 1);
        }

        return byIdDesc(left, right);
    }

    if (sort.key === "type") {
        // Answered before `flip` is applied, so a row with no type stays at the bottom either way.
        if (left.typeLabel === null || right.typeLabel === null) {
            if (left.typeLabel !== right.typeLabel) {
                return left.typeLabel === null ? 1 : -1;
            }

            return byDateDesc(left, right);
        }

        return flip * collator.compare(left.typeLabel, right.typeLabel) || byDateDesc(left, right);
    }

    return flip * collator.compare(left.label, right.label) || byDateDesc(left, right);
}

/**
 * Sorts a list of favourites without mutating it — the arrays are server-component props and must
 * not be reordered in place.
 *
 * Decorate, sort, undecorate: `project` runs once per row rather than twice per comparison, which is
 * the difference between n and n log n calls into the view model.
 */
export function sortFavorites<T>(
    rows: readonly T[],
    sort: FavoriteSort,
    project: (row: T) => FavoriteSortFields,
): T[] {
    return rows
        .map((row) => ({ row, fields: project(row) }))
        .sort((left, right) => compareFavorites(left.fields, right.fields, sort))
        .map(({ row }) => row);
}

/** An item's projection. Its type is always set, so `typeLabel` is never null on this side. */
export function itemSortFields(item: ItemSummaryViewModel): FavoriteSortFields {
    return {
        label: item.title,
        sortDate: item.editedAt,
        typeLabel: item.itemType.label,
        id: item.id,
    };
}

/**
 * A collection's projection. `typeLabel` is null when the collection has no dominant type — the rule
 * {@link compareFavorites} handles, not a gap.
 */
export function collectionSortFields(collection: FavoriteCollectionViewModel): FavoriteSortFields {
    return {
        label: collection.name,
        sortDate: collection.updatedAt,
        typeLabel: collection.dominantItemType?.label ?? null,
        id: collection.id,
    };
}
