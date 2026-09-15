import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The palette's data is prefetched for whoever is signed in and then matched entirely in the
 * browser, which makes the owner filter the whole of its access control: nothing downstream ever
 * checks again, and every row handed over is one the client can read. So the property under test is
 * the same one `items.test.ts` pins for the drawer — a query that stopped filtering on `userId`
 * would still type-check and still render, while quietly loading every account's titles into one
 * user's palette.
 *
 * Prisma is an in-memory stand-in for the same reason it is there: the question is which rows are
 * matched and what shape they leave in, not how Postgres answers.
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
    fileName: string | null;
    fileSize: number | null;
    tags: { name: string }[];
};

type CollectionRow = {
    id: string;
    userId: string;
    name: string;
    _count: { items: number };
};

const db = vi.hoisted(() => ({ items: [] as ItemRow[], collections: [] as CollectionRow[] }));

vi.mock("./current-user", () => ({
    getCurrentUserId: () => Promise.resolve("user-owner"),
}));

vi.mock("@/server/infra/prisma", () => {
    // Filters on the keys actually present, the way Prisma does — which is what makes the ownership
    // tests load-bearing rather than decorative.
    const byOwner = <T extends { userId: string }>(rows: T[], where: { userId?: string }) =>
        rows.filter((row) => where.userId === undefined || row.userId === where.userId);

    return {
        prisma: {
            item: {
                findMany: ({ where, take }: { where: { userId?: string }; take?: number }) =>
                    Promise.resolve(byOwner(db.items, where).slice(0, take)),
            },
            collection: {
                findMany: ({ where }: { where: { userId?: string } }) =>
                    Promise.resolve(byOwner(db.collections, where)),
            },
            itemType: {
                findMany: () =>
                    Promise.resolve([
                        { id: "type-snippet", name: "snippet", icon: "Code", color: "#FF5C5C" },
                    ]),
            },
        },
    };
});

const { getSearchData } = await import("./search");

function makeItem(overrides: Partial<ItemRow> = {}): ItemRow {
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
        fileName: null,
        fileSize: null,
        tags: [{ name: "react" }, { name: "auth" }],
        ...overrides,
    };
}

describe("getSearchData", () => {
    beforeEach(() => {
        db.items = [];
        db.collections = [];
    });

    it("returns only the signed-in user's items", async () => {
        db.items = [makeItem(), makeItem({ id: "item-theirs", userId: "user-other" })];

        const { items } = await getSearchData();

        expect(items.map((item) => item.id)).toEqual(["item-1"]);
    });

    it("returns only the signed-in user's collections", async () => {
        db.collections = [
            {
                id: "collection-1",
                userId: "user-owner",
                name: "React Patterns",
                _count: { items: 3 },
            },
            { id: "collection-2", userId: "user-other", name: "Theirs", _count: { items: 9 } },
        ];

        const { collections } = await getSearchData();

        expect(collections).toEqual([{ id: "collection-1", name: "React Patterns", itemCount: 3 }]);
    });

    it("builds item summaries the drawer can open on, with tags flattened and no body", async () => {
        db.items = [makeItem()];

        const [item] = (await getSearchData()).items;

        expect(item).toMatchObject({
            id: "item-1",
            title: "useAuth Hook",
            description: "Custom authentication hook",
            tags: ["react", "auth"],
            editedAt: "2026-01-02T00:00:00.000Z",
        });
        expect(item.itemType.label).toBe("Snippets");
        // The palette matches on titles, tags, and descriptions precisely because no query on this
        // path reads an item body — see `project-overview.md` §5.
        expect(item).not.toHaveProperty("content");
        expect(item).not.toHaveProperty("url");
    });

    it("caps how many items are prefetched", async () => {
        db.items = Array.from({ length: 250 }, (unused, index) =>
            makeItem({ id: `item-${index}` }),
        );

        expect((await getSearchData()).items).toHaveLength(200);
    });
});
