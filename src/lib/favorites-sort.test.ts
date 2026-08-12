import { describe, expect, it } from "vitest";

import {
    collectionSortFields,
    compareFavorites,
    DEFAULT_FAVORITE_SORT,
    itemSortFields,
    sortFavorites,
    type FavoriteSort,
    type FavoriteSortFields,
} from "./favorites-sort";

/**
 * A row reduced to what the comparator reads. The point of `FavoriteSortFields` being its own type
 * is that these tests need no view-model fixtures — they state the rule directly.
 */
function row(fields: Partial<FavoriteSortFields> & { id: string }): FavoriteSortFields {
    return {
        label: "untitled",
        sortDate: "2026-01-01T00:00:00.000Z",
        typeLabel: "Snippets",
        ...fields,
    };
}

/** Sorts plain fields, so the assertions can read as the list of ids they expect. */
function order(rows: FavoriteSortFields[], sort: FavoriteSort): string[] {
    return sortFavorites(rows, sort, (fields) => fields).map((fields) => fields.id);
}

describe("compareFavorites — name", () => {
    const rows = [
        row({ id: "b", label: "beta" }),
        row({ id: "a", label: "Alpha" }),
        row({ id: "c", label: "gamma" }),
    ];

    it("sorts A–Z ascending, ignoring case", () => {
        expect(order(rows, { key: "name", direction: "asc" })).toEqual(["a", "b", "c"]);
    });

    it("sorts Z–A descending", () => {
        expect(order(rows, { key: "name", direction: "desc" })).toEqual(["c", "b", "a"]);
    });

    it("orders digits by value, not by character", () => {
        const numbered = [
            row({ id: "10", label: "item10" }),
            row({ id: "2", label: "item2" }),
            row({ id: "1", label: "item1" }),
        ];

        expect(order(numbered, { key: "name", direction: "asc" })).toEqual(["1", "2", "10"]);
    });

    /**
     * Two names differing only in case are a *tie*, not an ordering — which is the whole point of
     * sorting on a base-sensitivity collator rather than on `<`. Under ASCII order every capital
     * sorts before every lowercase letter, so `APIKEY` and `Zebra` would sandwich `apiKey`.
     */
    it("treats a case-only difference as a tie, and hands it to the tiebreak", () => {
        const cased = [
            row({ id: "z", label: "zebra" }),
            row({ id: "upper", label: "APIKEY", sortDate: "2026-01-02T00:00:00.000Z" }),
            row({ id: "lower", label: "apiKey", sortDate: "2026-01-03T00:00:00.000Z" }),
        ];

        expect(order(cased, { key: "name", direction: "asc" })).toEqual(["lower", "upper", "z"]);
    });
});

describe("compareFavorites — date", () => {
    const rows = [
        row({ id: "old", sortDate: "2026-01-01T00:00:00.000Z" }),
        row({ id: "new", sortDate: "2026-03-01T00:00:00.000Z" }),
        row({ id: "mid", sortDate: "2026-02-01T00:00:00.000Z" }),
    ];

    it("sorts newest first descending, which is what the server already returned", () => {
        expect(order(rows, { key: "date", direction: "desc" })).toEqual(["new", "mid", "old"]);
    });

    it("sorts oldest first ascending", () => {
        expect(order(rows, { key: "date", direction: "asc" })).toEqual(["old", "mid", "new"]);
    });

    it("breaks a tied timestamp by id descending, in both directions", () => {
        const tied = [row({ id: "a" }), row({ id: "c" }), row({ id: "b" })];

        expect(order(tied, { key: "date", direction: "desc" })).toEqual(["c", "b", "a"]);
        expect(order(tied, { key: "date", direction: "asc" })).toEqual(["c", "b", "a"]);
    });
});

describe("compareFavorites — type", () => {
    const rows = [
        row({ id: "s", typeLabel: "Snippets" }),
        row({ id: "c", typeLabel: "Commands" }),
        row({ id: "n", typeLabel: "Notes" }),
    ];

    it("sorts by the type's display label", () => {
        expect(order(rows, { key: "type", direction: "asc" })).toEqual(["c", "n", "s"]);
        expect(order(rows, { key: "type", direction: "desc" })).toEqual(["s", "n", "c"]);
    });

    it("puts rows with no type last — and reversing the direction does not lift them", () => {
        const mixed = [
            row({ id: "none", typeLabel: null }),
            row({ id: "s", typeLabel: "Snippets" }),
            row({ id: "c", typeLabel: "Commands" }),
        ];

        expect(order(mixed, { key: "type", direction: "asc" })).toEqual(["c", "s", "none"]);
        expect(order(mixed, { key: "type", direction: "desc" })).toEqual(["s", "c", "none"]);
    });

    it("orders two untyped rows against each other by the standing tiebreak", () => {
        const untyped = [
            row({ id: "a", typeLabel: null, sortDate: "2026-01-01T00:00:00.000Z" }),
            row({ id: "b", typeLabel: null, sortDate: "2026-05-01T00:00:00.000Z" }),
        ];

        expect(order(untyped, { key: "type", direction: "asc" })).toEqual(["b", "a"]);
        expect(order(untyped, { key: "type", direction: "desc" })).toEqual(["b", "a"]);
    });
});

describe("compareFavorites — the tiebreak", () => {
    /**
     * The rule that is easiest to get wrong: only the primary key reverses. If the tiebreak flipped
     * with it, toggling the arrow would reshuffle every equal-keyed row.
     */
    it("does not reverse with the direction", () => {
        const tied = [
            row({ id: "a", label: "same", sortDate: "2026-01-01T00:00:00.000Z" }),
            row({ id: "b", label: "same", sortDate: "2026-02-01T00:00:00.000Z" }),
        ];

        expect(order(tied, { key: "name", direction: "asc" })).toEqual(["b", "a"]);
        expect(order(tied, { key: "name", direction: "desc" })).toEqual(["b", "a"]);
    });

    it("falls back to the id once the timestamps also tie", () => {
        const tied = [row({ id: "a", label: "same" }), row({ id: "b", label: "same" })];

        expect(order(tied, { key: "name", direction: "asc" })).toEqual(["b", "a"]);
    });

    it("is a total order, so the result does not depend on the order the rows arrived in", () => {
        const rows = [
            row({ id: "a", label: "same", typeLabel: null }),
            row({ id: "b", label: "same", typeLabel: "Notes" }),
            row({ id: "c", label: "same", typeLabel: "Notes" }),
        ];

        for (const sort of [
            { key: "name", direction: "asc" },
            { key: "type", direction: "desc" },
            { key: "date", direction: "asc" },
        ] satisfies FavoriteSort[]) {
            const forwards = order(rows, sort);

            expect(order([...rows].reverse(), sort)).toEqual(forwards);
        }
    });

    it("reports a row as equal to itself", () => {
        const only = row({ id: "a" });

        expect(compareFavorites(only, only, DEFAULT_FAVORITE_SORT)).toBe(0);
    });
});

describe("sortFavorites", () => {
    it("does not mutate the array it was given", () => {
        const rows = [row({ id: "b", label: "beta" }), row({ id: "a", label: "alpha" })];
        const original = [...rows];

        sortFavorites(rows, { key: "name", direction: "asc" }, (fields) => fields);

        expect(rows).toEqual(original);
    });

    it("projects each row once, not once per comparison", () => {
        const rows = [row({ id: "a" }), row({ id: "b" }), row({ id: "c" }), row({ id: "d" })];
        let projections = 0;

        sortFavorites(rows, { key: "name", direction: "asc" }, (fields) => {
            projections += 1;

            return fields;
        });

        expect(projections).toBe(rows.length);
    });
});

describe("the projections", () => {
    /**
     * The two sides do not date themselves from the same column, which is the reason `sortDate` is
     * named for its use rather than after either of them: an item dates from `editedAt`, a
     * collection from `updatedAt`. These two tests are what pins that down.
     */
    it("reads an item's title, its edit date, and its type label", () => {
        const item = {
            id: "item-1",
            title: "useDebounce",
            editedAt: "2026-04-01T00:00:00.000Z",
            itemType: { label: "Snippets" },
        };

        expect(itemSortFields(item as Parameters<typeof itemSortFields>[0])).toEqual({
            id: "item-1",
            label: "useDebounce",
            sortDate: "2026-04-01T00:00:00.000Z",
            typeLabel: "Snippets",
        });
    });

    it("reads a collection's name, its update date, and its dominant type label", () => {
        const collection = {
            id: "collection-1",
            name: "React Patterns",
            updatedAt: "2026-04-01T00:00:00.000Z",
            dominantItemType: { label: "Snippets" },
        };

        expect(
            collectionSortFields(collection as Parameters<typeof collectionSortFields>[0]),
        ).toEqual({
            id: "collection-1",
            label: "React Patterns",
            sortDate: "2026-04-01T00:00:00.000Z",
            typeLabel: "Snippets",
        });
    });

    it("gives a collection with no dominant type a null label rather than a stand-in", () => {
        const collection = {
            id: "collection-2",
            name: "Empty",
            updatedAt: "2026-04-01T00:00:00.000Z",
            dominantItemType: null,
        };

        expect(
            collectionSortFields(collection as Parameters<typeof collectionSortFields>[0])
                .typeLabel,
        ).toBeNull();
    });
});
