import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The property under test is the one these writes must not get wrong: an item that is not the
 * signed-in user's is never updated or deleted, and is reported exactly as a missing one. Ownership
 * lives in the `where` rather than in a check on a row read first, so a refactor to
 * `where: { id: itemId }` would still type-check, still pass every schema test, and let any signed-in
 * account edit or destroy any item by id — this is what would fail instead.
 *
 * It is the write-side twin of the `getItemDetail` test in `server/items.test.ts`, and the same
 * in-memory stand-in: the question is which rows are matched, not how Postgres answers. It is also
 * the one property clicking through the UI cannot check, since proving it by hand needs a second
 * account and an item id belonging to it.
 */

type ItemRow = {
    id: string;
    userId: string;
    title: string;
    contentType?: string;
    itemTypeId?: string;
};

type ItemTypeRow = { id: string; name: string; userId: string | null };

const db = vi.hoisted(() => ({ items: [] as ItemRow[], itemTypes: [] as ItemTypeRow[] }));

// The signed-in user is fixed: these tests vary who owns the row, not who is asking.
vi.mock("@/server/current-user", () => ({
    getCurrentUserId: () => Promise.resolve("user-owner"),
}));

// The action re-reads through this after a successful write. What it returns does not matter here —
// only that the read happened, which means the update was not rejected.
vi.mock("@/server/items", () => ({
    getItemDetail: (id: string) => Promise.resolve({ id, title: "Renamed" }),
}));

vi.mock("@/lib/prisma", async () => {
    const { Prisma } = await import("@/generated/prisma-client/client");

    type ItemWhere = { id?: string; userId?: string };

    // Filters only on the keys actually present, the way Prisma does. That is what makes the
    // ownership tests load-bearing: drop `userId` from the query and this fake starts matching on
    // id alone, hitting the other user's row instead of raising.
    const match = (where: ItemWhere) =>
        db.items.find(
            (candidate) =>
                (where.id === undefined || candidate.id === where.id) &&
                (where.userId === undefined || candidate.userId === where.userId),
        );

    // What Prisma raises when nothing matched — the error both actions turn into "This item no
    // longer exists."
    const notFound = () =>
        Promise.reject(
            new Prisma.PrismaClientKnownRequestError("No record was found", {
                code: "P2025",
                clientVersion: "test",
            }),
        );

    /** What `createItem` builds: relations connected by id, never ids assigned as columns. */
    type CreateData = {
        title: string;
        contentType: string;
        user: { connect: { id: string } };
        itemType: { connect: { id: string } };
    };

    return {
        prisma: {
            tag: { createMany: () => Promise.resolve({ count: 0 }) },
            itemType: {
                // Matches on both keys for the same reason the item matcher does: drop `userId` from
                // the query and a user's custom type of the same name starts winning.
                findFirst: ({ where }: { where: { name: string; userId: string | null } }) =>
                    Promise.resolve(
                        db.itemTypes.find(
                            (candidate) =>
                                candidate.name === where.name && candidate.userId === where.userId,
                        ) ?? null,
                    ),
            },
            item: {
                create: ({ data }: { data: CreateData }) => {
                    const row = {
                        id: `item-${db.items.length + 1}`,
                        userId: data.user.connect.id,
                        itemTypeId: data.itemType.connect.id,
                        contentType: data.contentType,
                        title: data.title,
                    };

                    db.items.push(row);

                    return Promise.resolve({ id: row.id });
                },
                update: ({ where }: { where: ItemWhere }) => {
                    const row = match(where);

                    return row ? Promise.resolve(row) : notFound();
                },
                delete: ({ where }: { where: ItemWhere }) => {
                    const row = match(where);

                    if (!row) return notFound();

                    // Actually removed, so a test can assert the row the caller does not own is
                    // still there afterwards.
                    db.items = db.items.filter((candidate) => candidate !== row);

                    return Promise.resolve(row);
                },
            },
        },
    };
});

const { createItem, deleteItem, updateItem } = await import("./items");

describe("createItem", () => {
    beforeEach(() => {
        db.items = [];
        // The custom type comes first, so a `findFirst` that stopped filtering on `userId` would
        // return it — which is the bug the `name`-alone lookup in `schema.prisma`'s note describes.
        db.itemTypes = [
            { id: "type-custom-snippet", name: "snippet", userId: "user-owner" },
            { id: "type-snippet", name: "snippet", userId: null },
            { id: "type-link", name: "link", userId: null },
        ];
    });

    it("writes the row for the signed-in user and the system type it names", async () => {
        const result = await createItem({ type: "snippet", title: "My snippet" });

        expect(result).toEqual({ success: true, data: { id: "item-1" } });
        expect(db.items[0]).toMatchObject({
            userId: "user-owner",
            itemTypeId: "type-snippet",
            title: "My snippet",
        });
    });

    it("derives contentType from the chosen type, not from the payload", async () => {
        // `contentType` discriminates which content column is populated, so a client that could set
        // it could describe a link as text — the schema drops the columns, this pins the flag.
        await createItem({ type: "link", title: "Docs", url: "https://example.com" });

        expect(db.items[0]).toMatchObject({ contentType: "URL", itemTypeId: "type-link" });
    });

    it("fails cleanly when the system type is not seeded", async () => {
        db.itemTypes = [];

        await expect(createItem({ type: "snippet", title: "My snippet" })).resolves.toEqual({
            success: false,
            error: "That item type is unavailable right now.",
        });
        expect(db.items).toHaveLength(0);
    });

    it("rejects an invalid payload before reaching the database", async () => {
        await expect(createItem({ type: "link", title: "Docs" })).resolves.toMatchObject({
            success: false,
            fields: { url: "URL is required." },
        });
        expect(db.items).toHaveLength(0);
    });
});

describe("updateItem", () => {
    beforeEach(() => {
        db.items = [];
    });

    it("refuses to update an item owned by another user", async () => {
        db.items = [{ id: "item-theirs", userId: "user-other", title: "Their snippet" }];

        await expect(updateItem("item-theirs", { title: "Renamed" })).resolves.toEqual({
            success: false,
            error: "This item no longer exists.",
        });
    });

    it("answers a missing item the same way, so the two are indistinguishable", async () => {
        await expect(updateItem("item-nonexistent", { title: "Renamed" })).resolves.toEqual({
            success: false,
            error: "This item no longer exists.",
        });
    });

    it("updates an item the caller owns", async () => {
        db.items = [{ id: "item-1", userId: "user-owner", title: "My snippet" }];

        const result = await updateItem("item-1", { title: "Renamed" });

        expect(result.success).toBe(true);
    });

    it("rejects an invalid payload before reaching the database", async () => {
        db.items = [{ id: "item-1", userId: "user-owner", title: "My snippet" }];

        await expect(updateItem("item-1", { title: "   " })).resolves.toMatchObject({
            success: false,
            error: "Title is required.",
            fields: { title: "Title is required." },
        });
    });
});

describe("deleteItem", () => {
    beforeEach(() => {
        db.items = [];
    });

    it("refuses to delete an item owned by another user, and leaves it there", async () => {
        db.items = [{ id: "item-theirs", userId: "user-other", title: "Their snippet" }];

        await expect(deleteItem("item-theirs")).resolves.toEqual({
            success: false,
            error: "This item no longer exists.",
        });
        expect(db.items).toHaveLength(1);
    });

    it("answers a missing item the same way, so the two are indistinguishable", async () => {
        await expect(deleteItem("item-nonexistent")).resolves.toEqual({
            success: false,
            error: "This item no longer exists.",
        });
    });

    it("deletes an item the caller owns", async () => {
        db.items = [{ id: "item-1", userId: "user-owner", title: "My snippet" }];

        await expect(deleteItem("item-1")).resolves.toEqual({ success: true });
        expect(db.items).toHaveLength(0);
    });
});
