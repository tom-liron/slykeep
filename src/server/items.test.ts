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
    updatedAt: Date;
    createdAt: Date;
    content: string | null;
    url: string | null;
    language: string | null;
    tags: { name: string }[];
    collections: { collection: { name: string } }[];
};

const db = vi.hoisted(() => ({ items: [] as ItemRow[] }));

// The signed-in user is fixed: these tests vary who owns the row, not who is asking.
vi.mock("./current-user", () => ({
    getCurrentUserId: () => Promise.resolve("user-owner"),
    getCurrentUser: () => Promise.resolve({ id: "user-owner", isPro: true }),
}));

vi.mock("@/lib/prisma", () => ({
    prisma: {
        item: {
            // Filters only on the keys actually present, the way Prisma does. That is what makes
            // the ownership test load-bearing: drop `userId` from the query and this fake starts
            // matching on id alone, handing back the other user's row rather than quietly missing.
            findFirst: ({ where }: { where: { id?: string; userId?: string } }) =>
                Promise.resolve(
                    db.items.find(
                        (row) =>
                            (where.id === undefined || row.id === where.id) &&
                            (where.userId === undefined || row.userId === where.userId),
                    ) ?? null,
                ),
        },
        itemType: {
            findMany: () =>
                Promise.resolve([
                    { id: "type-snippet", name: "snippet", icon: "Code", color: "#3b82f6" },
                ]),
        },
    },
}));

const { getItemDetail } = await import("./items");

function makeRow(overrides: Partial<ItemRow> = {}): ItemRow {
    return {
        id: "item-1",
        userId: "user-owner",
        title: "useAuth Hook",
        description: "Custom authentication hook",
        itemTypeId: "type-snippet",
        isFavorite: false,
        isPinned: false,
        updatedAt: new Date("2026-01-02T00:00:00Z"),
        createdAt: new Date("2026-01-01T00:00:00Z"),
        content: "const x = 1;",
        url: null,
        language: "typescript",
        tags: [{ name: "react" }, { name: "auth" }],
        collections: [{ collection: { name: "React Patterns" } }],
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

    it("flattens tags and collection names onto the view model", async () => {
        db.items = [makeRow()];

        const item = await getItemDetail("item-1");

        expect(item).toMatchObject({
            id: "item-1",
            title: "useAuth Hook",
            content: "const x = 1;",
            url: "",
            language: "typescript",
            tags: ["react", "auth"],
            collections: ["React Patterns"],
            createdAt: "2026-01-01T00:00:00.000Z",
        });
        expect(item?.itemType.label).toBe("Snippets");
    });
});
