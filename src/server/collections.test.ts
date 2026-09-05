import { beforeEach, describe, expect, it, vi } from "vitest";

import { SIDEBAR_RECENT_COLLECTIONS_LIMIT } from "@/config/dashboard";

/**
 * The collection reads, and the two properties they must not get wrong.
 *
 * **Ownership.** Every one of these queries takes an id or returns a list, and every one of them
 * scopes on `userId` inside the `where` rather than checking the result afterwards. That is
 * deliberate and it is also invisible: dropping `userId` from `getCollectionPageData`'s `findFirst`
 * would still type-check, still render, and quietly serve another account's collection. So the
 * tests here assert the *absence* of other people's rows, which is the only way that failure shows
 * up.
 *
 * **The dominant type.** The rule — most common type, ties broken by the most recently edited item
 * among the tied ones — is `resolveDominantTypeId`'s and is unit-tested there. What is tested here
 * is that the queries feed it the right rows and that all three surfaces agree, which is the thing
 * that was wrong until recently: two of them resolved an unresolvable id to `null` while the third
 * threw.
 *
 * Prisma is an in-memory stand-in rather than a test database, the same way `items.test.ts` and
 * `search.test.ts` do it: the question is which rows are matched, not how Postgres answers.
 */

type ItemJoin = { item: { itemTypeId: string; editedAt: Date } };

type CollectionRow = {
    id: string;
    userId: string;
    name: string;
    description: string | null;
    isFavorite: boolean;
    defaultTypeId: string | null;
    updatedAt: Date;
    items: ItemJoin[];
};

type ItemRow = {
    id: string;
    userId: string;
    title: string;
    description: string | null;
    itemTypeId: string;
    isFavorite: boolean;
    isPinned: boolean;
    editedAt: Date;
    createdAt: Date;
    fileName: string | null;
    fileSize: number | null;
    tags: { name: string }[];
    collectionIds: string[];
};

type CollectionWhere = { id?: string; userId?: string; isFavorite?: boolean };

const db = vi.hoisted(() => ({
    collections: [] as CollectionRow[],
    items: [] as ItemRow[],
    /** Every `collection.findMany`, so the sidebar's two queries can be told apart and asserted on. */
    collectionFindManyCalls: [] as { where?: CollectionWhere; take?: number }[],
}));

// The signed-in user is fixed: these tests vary who owns the row, not who is asking.
vi.mock("./current-user", () => ({
    getCurrentUserId: () => Promise.resolve("user-owner"),
    getCurrentUser: () => Promise.resolve({ id: "user-owner", isPro: true }),
}));

vi.mock("@/server/infra/prisma", () => {
    // Filters only on the keys actually present, the way Prisma does. That is what makes the
    // ownership tests load-bearing: drop `userId` from a query and this starts matching on the rest
    // alone, handing back the other user's rows rather than quietly missing.
    const matches = (row: CollectionRow, where: CollectionWhere) =>
        (where.id === undefined || row.id === where.id) &&
        (where.userId === undefined || row.userId === where.userId) &&
        (where.isFavorite === undefined || row.isFavorite === where.isFavorite);

    return {
        prisma: {
            collection: {
                findFirst: ({ where }: { where: CollectionWhere }) =>
                    Promise.resolve(db.collections.find((row) => matches(row, where)) ?? null),
                findMany: (args: { where?: CollectionWhere; skip?: number; take?: number }) => {
                    db.collectionFindManyCalls.push(args);

                    const rows = db.collections.filter((row) => matches(row, args.where ?? {}));
                    const from = args.skip ?? 0;

                    return Promise.resolve(
                        args.take === undefined
                            ? rows.slice(from)
                            : rows.slice(from, from + args.take),
                    );
                },
                count: ({ where }: { where: CollectionWhere }) =>
                    Promise.resolve(db.collections.filter((row) => matches(row, where)).length),
            },
            item: {
                findMany: ({
                    where,
                }: {
                    where: { userId?: string; collections?: { some: { collectionId: string } } };
                }) =>
                    Promise.resolve(
                        db.items.filter(
                            (row) =>
                                (where.userId === undefined || row.userId === where.userId) &&
                                (where.collections === undefined ||
                                    row.collectionIds.includes(
                                        where.collections.some.collectionId,
                                    )),
                        ),
                    ),
            },
            itemType: {
                findMany: () =>
                    Promise.resolve([
                        { id: "type-snippet", name: "snippet", icon: "Code", color: "#3b82f6" },
                        { id: "type-note", name: "note", icon: "StickyNote", color: "#fde047" },
                    ]),
            },
        },
    };
});

const { getCollectionPageData, getCollections, getFavoriteCollections, getSidebarCollections } =
    await import("./collections");

function joined(itemTypeId: string, editedAt: string): ItemJoin {
    return { item: { itemTypeId, editedAt: new Date(`${editedAt}T00:00:00Z`) } };
}

function makeCollection(overrides: Partial<CollectionRow> = {}): CollectionRow {
    return {
        id: "collection-1",
        userId: "user-owner",
        name: "React Patterns",
        description: "Hooks worth keeping",
        isFavorite: false,
        defaultTypeId: null,
        updatedAt: new Date("2026-01-02T00:00:00Z"),
        items: [joined("type-snippet", "2026-01-02")],
        ...overrides,
    };
}

function makeItem(overrides: Partial<ItemRow> = {}): ItemRow {
    return {
        id: "item-1",
        userId: "user-owner",
        title: "useAuth Hook",
        description: null,
        itemTypeId: "type-snippet",
        isFavorite: false,
        isPinned: false,
        editedAt: new Date("2026-01-02T00:00:00Z"),
        createdAt: new Date("2026-01-01T00:00:00Z"),
        fileName: null,
        fileSize: null,
        tags: [{ name: "react" }],
        collectionIds: ["collection-1"],
        ...overrides,
    };
}

beforeEach(() => {
    db.collections = [];
    db.items = [];
    db.collectionFindManyCalls = [];
});

describe("ownership", () => {
    it("never lists another user's collections", async () => {
        db.collections = [
            makeCollection({ id: "mine" }),
            makeCollection({ id: "theirs", userId: "user-other" }),
        ];

        const { collections } = await getCollections(1);

        expect(collections.map((collection) => collection.id)).toEqual(["mine"]);
    });

    it("reports another user's collection as missing rather than forbidden", async () => {
        // The id is real and the row exists — it just is not this user's. `undefined` is what the
        // page turns into a 404, so the two cases are indistinguishable from outside, which is the
        // point: a different answer here would confirm the id exists.
        db.collections = [makeCollection({ id: "theirs", userId: "user-other" })];

        expect(await getCollectionPageData("theirs", 1)).toBeUndefined();
    });

    it("scopes a collection's items by owner as well as by membership", async () => {
        // Belt and braces on a page that has already authorized the collection: the item query
        // carries `userId` too, so a membership row pointing at someone else's item cannot widen
        // what the collection read allowed.
        db.collections = [makeCollection()];
        db.items = [makeItem({ id: "mine" }), makeItem({ id: "theirs", userId: "user-other" })];

        const page = await getCollectionPageData("collection-1", 1);

        expect(page?.items.map((item) => item.id)).toEqual(["mine"]);
    });

    it("never lists another user's favourites", async () => {
        db.collections = [
            makeCollection({ id: "mine", isFavorite: true }),
            makeCollection({ id: "theirs", userId: "user-other", isFavorite: true }),
        ];

        const favorites = await getFavoriteCollections();

        expect(favorites.map((collection) => collection.id)).toEqual(["mine"]);
    });
});

describe("the collection summary", () => {
    it("counts items and colours the collection by its dominant type", async () => {
        db.collections = [
            makeCollection({
                items: [
                    joined("type-note", "2026-01-01"),
                    joined("type-snippet", "2026-01-02"),
                    joined("type-snippet", "2026-01-03"),
                ],
            }),
        ];

        const { collections } = await getCollections(1);

        expect(collections[0].itemCount).toBe(3);
        expect(collections[0].dominantItemType?.name).toBe("snippet");
    });

    it("breaks a tie with the most recently edited of the tied types", async () => {
        db.collections = [
            makeCollection({
                items: [joined("type-snippet", "2026-01-01"), joined("type-note", "2026-01-05")],
            }),
        ];

        const { collections } = await getCollections(1);

        expect(collections[0].dominantItemType?.name).toBe("note");
    });

    it("falls back to the default type when the collection is empty", async () => {
        db.collections = [makeCollection({ items: [], defaultTypeId: "type-note" })];

        const { collections } = await getCollections(1);

        expect(collections[0].itemCount).toBe(0);
        expect(collections[0].dominantItemType?.name).toBe("note");
    });

    it("has no dominant type when it is empty and has no default", async () => {
        // §5: a collection with no items and no `defaultTypeId` has no dominant type at all, and the
        // card renders a neutral accent rather than picking one.
        db.collections = [makeCollection({ items: [], defaultTypeId: null })];

        const { collections } = await getCollections(1);

        expect(collections[0].dominantItemType).toBeNull();
    });

    it("agrees across the cards, the sidebar, and the favourites list", async () => {
        // The three surfaces derived these fields separately until `buildCollectionSummary`, and two
        // of them disagreed with the third about an unresolvable type. This is what keeps them one
        // answer: same row, same count, same dominant type, whichever list it is read from.
        const items = [joined("type-note", "2026-01-01"), joined("type-snippet", "2026-01-02")];
        db.collections = [makeCollection({ isFavorite: true, items })];

        const [{ collections }, sidebar, favorites] = await Promise.all([
            getCollections(1),
            getSidebarCollections(),
            getFavoriteCollections(),
        ]);

        const card = collections[0];
        const sidebarRow = sidebar.favoriteCollections[0];
        const favoriteRow = favorites[0];

        for (const row of [sidebarRow, favoriteRow]) {
            expect(row.itemCount).toBe(card.itemCount);
            expect(row.dominantItemType?.id).toBe(card.dominantItemType?.id);
        }
    });
});

describe("getSidebarCollections", () => {
    it("splits favourites from recents, and never repeats one in both", async () => {
        db.collections = [
            makeCollection({ id: "starred", isFavorite: true }),
            makeCollection({ id: "plain", isFavorite: false }),
        ];

        const { favoriteCollections, recentNonFavoriteCollections } = await getSidebarCollections();

        expect(favoriteCollections.map((collection) => collection.id)).toEqual(["starred"]);
        expect(recentNonFavoriteCollections.map((collection) => collection.id)).toEqual(["plain"]);
    });

    it("caps the recent list and leaves the favourites uncapped", async () => {
        // Favourites are a set the user chose and every one of them is shown; recents are a window
        // onto everything else, so only that half takes a limit.
        db.collections = [
            ...Array.from({ length: 7 }, (_, index) =>
                makeCollection({ id: `starred-${index}`, isFavorite: true }),
            ),
            ...Array.from({ length: 7 }, (_, index) =>
                makeCollection({ id: `plain-${index}`, isFavorite: false }),
            ),
        ];

        const { favoriteCollections, recentNonFavoriteCollections } = await getSidebarCollections();

        expect(favoriteCollections).toHaveLength(7);
        expect(recentNonFavoriteCollections).toHaveLength(SIDEBAR_RECENT_COLLECTIONS_LIMIT);

        const recentQuery = db.collectionFindManyCalls.find(
            (call) => call.where?.isFavorite === false,
        );
        expect(recentQuery?.take).toBe(SIDEBAR_RECENT_COLLECTIONS_LIMIT);
    });
});

describe("getCollectionPageData", () => {
    it("counts the whole collection in the header while paginating the grid below", async () => {
        // The two reads answer different questions, which is why the header's count comes from the
        // collection's own join rather than from the page of items: narrowing that join to a page
        // would quietly turn "24 items" into "21 items".
        db.collections = [
            makeCollection({
                items: Array.from({ length: 24 }, () => joined("type-snippet", "2026-01-02")),
            }),
        ];
        db.items = Array.from({ length: 24 }, (_, index) => makeItem({ id: `item-${index}` }));

        const page = await getCollectionPageData("collection-1", 1);

        expect(page?.collection.itemCount).toBe(24);
        expect(page?.pagination.totalCount).toBe(24);
        expect(page?.pagination.pageCount).toBe(2);
    });

    it("breaks the contained types down over the whole collection", async () => {
        db.collections = [
            makeCollection({
                items: [
                    joined("type-snippet", "2026-01-02"),
                    joined("type-snippet", "2026-01-03"),
                    joined("type-note", "2026-01-01"),
                ],
            }),
        ];

        const page = await getCollectionPageData("collection-1", 1);

        expect(page?.itemTypeCounts.map(({ label, itemCount }) => [label, itemCount])).toEqual([
            ["Snippets", 2],
            ["Notes", 1],
        ]);
    });
});
