import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The property under test is the one this read must not get wrong: an item that is not the signed-in
 * user's is never returned, and is reported exactly as a missing one. Ownership lives in the `where`
 * rather than in a check on the result, so a refactor to `findUnique({ where: { id } })` would still
 * type-check, still pass every view-model test, and quietly serve another account's items — this is
 * what would fail instead.
 *
 * Prisma is replaced with an in-memory stand-in rather than a test database, the same way
 * `verification.test.ts` does it: the question is which rows are matched, not how Postgres answers.
 */

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
    content: string | null;
    url: string | null;
    language: string | null;
    tags: { name: string }[];
    collections: { collection: { id: string; name: string } }[];
};

const db = vi.hoisted(() => ({
    items: [] as ItemRow[],
    /** The arguments the last `item.findMany` was given, so a test can assert on the ordering too. */
    lastFindManyArgs: null as { where?: ItemWhere; orderBy?: unknown } | null,
    /** Every such call, for the reads that issue more than one — the dashboard runs two at once. */
    findManyCalls: [] as { where?: ItemWhere; orderBy?: unknown }[],
}));

type ItemWhere = { id?: string; userId?: string; isFavorite?: boolean; isPinned?: boolean };

// The signed-in user is fixed: these tests vary who owns the row, not who is asking.
vi.mock("./current-user", () => ({
    getCurrentUserId: () => Promise.resolve("user-owner"),
    getCurrentUser: () => Promise.resolve({ id: "user-owner", isPro: true }),
}));

vi.mock("@/lib/prisma", () => {
    // Filters only on the keys actually present, the way Prisma does. That is what makes the
    // ownership tests load-bearing: drop `userId` from a query and this starts matching on the rest
    // alone, handing back the other user's rows rather than quietly missing.
    const matches = (row: ItemRow, where: ItemWhere) =>
        (where.id === undefined || row.id === where.id) &&
        (where.userId === undefined || row.userId === where.userId) &&
        (where.isFavorite === undefined || row.isFavorite === where.isFavorite) &&
        (where.isPinned === undefined || row.isPinned === where.isPinned);

    return {
        prisma: {
            item: {
                findFirst: ({ where }: { where: ItemWhere }) =>
                    Promise.resolve(db.items.find((row) => matches(row, where)) ?? null),
                findMany: (args: { where?: ItemWhere; orderBy?: unknown }) => {
                    db.lastFindManyArgs = args;
                    db.findManyCalls.push(args);

                    return Promise.resolve(
                        db.items.filter((row) => matches(row, args.where ?? {})),
                    );
                },
                count: ({ where }: { where: ItemWhere }) =>
                    Promise.resolve(db.items.filter((row) => matches(row, where)).length),
            },
            itemType: {
                findMany: () =>
                    Promise.resolve([
                        { id: "type-snippet", name: "snippet", icon: "Code", color: "#3b82f6" },
                    ]),
            },
        },
    };
});

const { getDashboardItems, getFavoriteItems, getItemDetail } = await import("./items");

function makeRow(overrides: Partial<ItemRow> = {}): ItemRow {
    return {
        id: "item-1",
        userId: "user-owner",
        title: "useAuth Hook",
        description: "Custom authentication hook",
        itemTypeId: "type-snippet",
        isFavorite: false,
        isPinned: false,
        editedAt: new Date("2026-01-02T00:00:00Z"),
        createdAt: new Date("2026-01-01T00:00:00Z"),
        content: "const x = 1;",
        url: null,
        language: "typescript",
        tags: [{ name: "react" }, { name: "auth" }],
        collections: [{ collection: { id: "collection-1", name: "React Patterns" } }],
        ...overrides,
    };
}

describe("getItemDetail", () => {
    beforeEach(() => {
        db.items = [];
    });

    it("does not return an item owned by another user", async () => {
        db.items = [makeRow({ id: "item-theirs", userId: "user-other" })];

        await expect(getItemDetail("item-theirs")).resolves.toBeUndefined();
    });

    it("answers a missing item the same way, so the two are indistinguishable", async () => {
        await expect(getItemDetail("item-nonexistent")).resolves.toBeUndefined();
    });

    it("flattens tags and collections onto the view model", async () => {
        db.items = [makeRow()];

        const item = await getItemDetail("item-1");

        expect(item).toMatchObject({
            id: "item-1",
            title: "useAuth Hook",
            content: "const x = 1;",
            url: "",
            language: "typescript",
            tags: ["react", "auth"],
            collections: [{ id: "collection-1", name: "React Patterns" }],
            createdAt: "2026-01-01T00:00:00.000Z",
        });
        expect(item?.itemType.label).toBe("Snippets");
    });
});

describe("getFavoriteItems", () => {
    beforeEach(() => {
        db.items = [];
        db.lastFindManyArgs = null;
    });

    it("returns only the signed-in user's favourites", async () => {
        db.items = [
            makeRow({ id: "item-mine", isFavorite: true }),
            makeRow({ id: "item-mine-unstarred", isFavorite: false }),
            makeRow({ id: "item-theirs", userId: "user-other", isFavorite: true }),
        ];

        const items = await getFavoriteItems();

        expect(items.map((item) => item.id)).toEqual(["item-mine"]);
    });

    it("asks for them most recently edited first, tie-broken by id", async () => {
        await getFavoriteItems();

        // Asserted on the query rather than on the result, because the ordering is Postgres's work
        // and the fake does none of it. The tiebreaker is the load-bearing half: without it two
        // items saved in the same write come back in whatever order the database felt like, and the
        // list appears to shuffle between renders.
        expect(db.lastFindManyArgs?.orderBy).toEqual([{ editedAt: "desc" }, { id: "desc" }]);
    });

    it("builds summaries with no item body in them", async () => {
        db.items = [makeRow({ isFavorite: true })];

        const [item] = await getFavoriteItems();

        expect(item).toMatchObject({
            id: "item-1",
            title: "useAuth Hook",
            tags: ["react", "auth"],
        });
        // The summary select does not read `content`, and the view model has nowhere to put one —
        // this is the rule that keeps an unpaginated list off the large columns.
        expect(item).not.toHaveProperty("content");
    });
});

/**
 * The regression this whole column exists for. Both dashboard lists used to order by `updatedAt`,
 * which Prisma moves on *any* write to the row — so starring a year-old snippet lifted it to the top
 * of "Recent Items", and unpinning one dropped it back in at position one. Neither is an edit.
 *
 * Asserted on the query rather than on the rows for the same reason the favourites test is: the fake
 * does no ordering, and the thing that was wrong was the key, not the sort.
 */
describe("getDashboardItems", () => {
    beforeEach(() => {
        db.items = [];
        db.findManyCalls = [];
    });

    it("orders both the pinned and the recent list by editedAt, never by updatedAt", async () => {
        await getDashboardItems();

        expect(db.findManyCalls).toHaveLength(2);

        for (const call of db.findManyCalls) {
            expect(call.orderBy).toEqual({ editedAt: "desc" });
        }
    });

    it("keeps the two lists disjoint, so a pinned item is not also a recent one", async () => {
        db.items = [
            makeRow({ id: "item-pinned", isPinned: true }),
            makeRow({ id: "item-loose", isPinned: false }),
        ];

        const { pinnedItems, recentItems } = await getDashboardItems();

        expect(pinnedItems.map((item) => item.id)).toEqual(["item-pinned"]);
        expect(recentItems.map((item) => item.id)).toEqual(["item-loose"]);
    });
});
