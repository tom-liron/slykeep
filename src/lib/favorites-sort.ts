import type { FavoriteCollectionViewModel, ItemSummaryViewModel } from "@/types/view-models";

/**
 * How `/favorites` orders its two lists, client-side.
 *
 * The page reads both sections already sorted — newest date first, `id desc` to break ties — and
 * that is the only order the server offers. Reordering by name or by type is a preference, not a
 * query: the rows are already on the client, both lists are small (one person's stars), and a round
 * trip to re-`ORDER BY` what is sitting in memory would be slower than the sort and would cost a
 * database read per click. So the rule lives here, as a pure function with a test, rather than in the
 * component that renders the dropdown.
 *
 * Items and collections are sorted by the same rule but are not the same shape — an item has a
 * `title` and always has a type, a collection has a `name` and may have none, and since the
 * `editedAt` split they do not even date themselves from the same column. Rather than a generic
 * constrained on fields they do not share, each shape projects to `FavoriteSortFields` and the
 * comparator sees only that. Which is the honest version of "these are different things": they are,
 * they merely sort by the same four values.
 */

/** The three things a favourite can be ordered by. */
export type FavoriteSortKey = "name" | "date" | "type";

export type SortDirection = "asc" | "desc";

export interface FavoriteSort {
    key: FavoriteSortKey;
    direction: SortDirection;
}

/**
 * Everything the comparator is allowed to look at, whatever it came from.
 *
 * `typeLabel` is nullable because a collection with no items and no `defaultTypeId` has no dominant
 * type. An item's type is never null, so that branch only ever fires on the collections list — but
 * it stays in the shared comparator rather than becoming a special case there, so both sections keep
 * one rule.
 */
export interface FavoriteSortFields {
    /** What the row is called: an item's title, a collection's name. */
    label: string;
    /**
     * The date the row actually renders, which is not the same column on both sides: an item's
     * `editedAt` (when its content last changed) and a collection's `updatedAt`. Named for what it
     * is used for rather than after either column, so neither side has to pretend to be the other.
     *
     * ISO-8601, UTC, as both view models serialize it. Compared as a string — see `byDateDesc`.
     */
    sortDate: string;
    /** The item type's display label, which is the only part of a type a user can see. Null when absent. */
    typeLabel: string | null;
    id: string;
}

/**
 * The direction each key opens in, which is not the same for all three.
 *
 * A date sorts newest-first and a name sorts A–Z, so a single shared default is wrong for one of
 * them whichever way it points. The control resets to these when the key changes rather than
 * carrying the previous direction across — switching from date to name would otherwise land on Z–A,
 * which reads as a bug rather than as a choice.
 */
export const DEFAULT_SORT_DIRECTION: Record<FavoriteSortKey, SortDirection> = {
    name: "asc",
    date: "desc",
    type: "asc",
};

/** What the page renders on arrival: the order the server already returned, so nothing moves on hydration. */
export const DEFAULT_FAVORITE_SORT: FavoriteSort = { key: "date", direction: "desc" };

/**
 * Case-insensitive and digit-aware, so `apiKey` and `APIKEY` tie rather than landing either side of
 * `Zebra`, and `item2` comes before `item10`. Punctuation still counts — `API_KEY` is a different
 * string, not a cased spelling of the same one.
 *
 * Built once: constructing a collator per comparison is the expensive half of this sort.
 */
const collator = new Intl.Collator(undefined, { sensitivity: "base", numeric: true });

/**
 * Newest first, then newest id, which is the order both server queries use.
 *
 * A string comparison rather than `Date.parse`, because both view models build this with
 * `toISOString()` — always UTC, always the same width — so lexicographic order *is* chronological.
 * That skips parsing two dates per comparison and, more usefully, makes this identical to what the
 * database returned rather than merely equivalent to it.
 */
function byDateDesc(left: FavoriteSortFields, right: FavoriteSortFields): number {
    if (left.sortDate !== right.sortDate) {
        return left.sortDate < right.sortDate ? 1 : -1;
    }

    return byIdDesc(left, right);
}

/** The last resort, and the only one that can return 0 — ids are unique, so it does so only for a row against itself. */
function byIdDesc(left: FavoriteSortFields, right: FavoriteSortFields): number {
    if (left.id === right.id) {
        return 0;
    }

    return left.id < right.id ? 1 : -1;
}

/**
 * Orders two favourites.
 *
 * A total order, not a partial one: every pair is decided, so the result never depends on the order
 * the rows arrived in and the tests do not have to care either.
 *
 * Two things here are load-bearing and both look like details:
 *
 * **The tiebreak is outside the direction flip.** Only the primary key reverses. A tiebreak that
 * reversed with it would reshuffle every equal-named row each time the arrow is toggled — jitter
 * that is harder to notice than the reordering the user asked for, and impossible to explain.
 *
 * **So is the missing-type branch.** Collections with no dominant type sink to the bottom in *both*
 * directions, so the check has to be answered before the multiplier is applied. Multiplied, "no type
 * last" quietly becomes "no type first" in descending, which is exactly the reading it exists to
 * avoid — a run of blank rows at the top of the list looks like the sort broke.
 */
export function compareFavorites(
    left: FavoriteSortFields,
    right: FavoriteSortFields,
    sort: FavoriteSort,
): number {
    const flip = sort.direction === "asc" ? 1 : -1;

    if (sort.key === "date") {
        // The date is the primary here, so the tiebreak below it is `id desc` alone — running the
        // full `byDateDesc` would compare the same field a second time.
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
 * Sorts a list of favourites without mutating it — the arrays come from a server component's props,
 * which are not ours to reorder in place.
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

/** An item's sort key. Its type is required, so `typeLabel` is never null on this side. */
export function itemSortFields(item: ItemSummaryViewModel): FavoriteSortFields {
    return {
        label: item.title,
        sortDate: item.editedAt,
        typeLabel: item.itemType.label,
        id: item.id,
    };
}

/** A collection's sort key. The null is the rule, not a gap: see `compareFavorites`. */
export function collectionSortFields(collection: FavoriteCollectionViewModel): FavoriteSortFields {
    return {
        label: collection.name,
        sortDate: collection.updatedAt,
        typeLabel: collection.dominantItemType?.label ?? null,
        id: collection.id,
    };
}
