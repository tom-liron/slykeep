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

type ItemRow = { id: string; userId: string; title: string };

const db = vi.hoisted(() => ({ items: [] as ItemRow[] }));

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

    return {
        prisma: {
            tag: { createMany: () => Promise.resolve({ count: 0 }) },
            item: {
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

const { deleteItem, updateItem } = await import("./items");

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
