import { beforeEach, describe, expect, it, vi } from "vitest";

import { DASHBOARD_RECENT_ITEMS_LIMIT } from "@/config/dashboard";

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
    lastFindManyArgs: null as { where?: ItemWhere; orderBy?: unknown; take?: number } | null,
    /** Every such call, for the reads that issue more than one — the dashboard runs two at once. */
    findManyCalls: [] as { where?: ItemWhere; orderBy?: unknown; take?: number }[],
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
                findMany: (args: { where?: ItemWhere; orderBy?: unknown; take?: number }) => {
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
 * Two regressions, both about a timestamp meaning the wrong thing. Both lists once ordered by
 * `updatedAt`, which Prisma moves on *any* write — so starring a year-old snippet lifted it to the
 * top of "Recent Items". And Pinned then ordered by `editedAt`, which made pinning an old item look
 * like it had done nothing.
 *
 * Asserted on the queries rather than on the rows: the fake does no ordering and no slicing, and
 * what was wrong in both cases was the key, not the sort.
 */
describe("getDashboardItems", () => {
    beforeEach(() => {
        db.items = [];
        db.findManyCalls = [];
    });

    it("orders the two lists by their own question: pins by pinnedAt, recency by editedAt", async () => {
        await getDashboardItems();

        const [pinned, recent] = db.findManyCalls;

        // Newest pin first. Ordering this by `editedAt` — as it was at first — buries a
        // just-pinned old item at the bottom of the section, so the click looks like a no-op.
        expect(pinned?.orderBy).toEqual([{ pinnedAt: "desc" }, { id: "desc" }]);
        // And never `updatedAt`, which moves on any write to the row including both toggles.
        expect(recent?.orderBy).toEqual({ editedAt: "desc" });
    });

    /**
     * The inverse of what this asserted a day earlier. Recent filtered `isPinned: false`, so pinning
     * an item removed it from the list entirely — and editing a pinned item then changed nothing
     * visible anywhere on the dashboard, which is how it was found. The two sections answer
     * different questions and one item can be the answer to both.
     */
    it("lets a pinned item appear in Recent too, rather than removing it", async () => {
        db.items = [
            makeRow({ id: "item-pinned", isPinned: true }),
            makeRow({ id: "item-loose", isPinned: false }),
        ];

        const { pinnedItems, recentItems } = await getDashboardItems();

        expect(pinnedItems.map((item) => item.id)).toEqual(["item-pinned"]);
        // Membership, not order: the fake does no sorting, so asserting a sequence here would only
        // pin down the order rows were pushed in. The ordering key has its own test above.
        expect(recentItems.map((item) => item.id)).toContain("item-pinned");
        expect(recentItems).toHaveLength(2);
    });

    /**
     * A cap on Pinned was implemented and then taken back out. It is the same kind of list
     * `/favorites` is — one the user lengthens themselves, a click at a time — and capping it means
     * pinning an item can visibly do nothing, which is the failure this whole change is about.
     * Recent has the opposite property: it grows on its own as you work, so it has to be bounded.
     */
    it("bounds Recent but not Pinned, since only one of them grows on its own", async () => {
        await getDashboardItems();

        const [pinned, recent] = db.findManyCalls;

        expect(pinned?.take).toBeUndefined();
        expect(recent?.take).toBe(DASHBOARD_RECENT_ITEMS_LIMIT);
    });
});
