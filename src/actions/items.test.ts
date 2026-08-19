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
    /** The type `updateItem` reads to decide which content columns this row owns. */
    itemTypeName?: string;
    /** What `toggleItemFavorite` writes, and what it reads back out of the row afterwards. */
    isFavorite?: boolean;
    /** The same, for `toggleItemPin`. */
    isPinned?: boolean;
};

type ItemTypeRow = { id: string; name: string; userId: string | null };

const db = vi.hoisted(() => ({
    items: [] as ItemRow[],
    itemTypes: [] as ItemTypeRow[],
    collections: [] as { id: string; userId: string }[],
    /** The nested collection write the last `item.create` was given, if any. */
    lastCreateCollections: null as unknown,
    // What the last `item.update` was asked to write, so a test can assert on the columns that were
    // left out as well as the ones that were sent.
    lastUpdateData: null as Record<string, unknown> | null,
}));

// The signed-in user is fixed: these tests vary who owns the row, not who is asking.
vi.mock("@/server/current-user", () => ({
    getCurrentUserId: () => Promise.resolve("user-owner"),
    // Pro, so the file-item tests below are about the upload check rather than the entitlement one.
    getCurrentUser: () => Promise.resolve({ id: "user-owner", isPro: true }),
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
        collections?: unknown;
    };

    return {
        prisma: {
            tag: { createMany: () => Promise.resolve({ count: 0 }) },
            collection: {
                // Counts on both keys, like the real query: drop `userId` and every id in the
                // payload starts counting as the caller's, which is the bug these tests exist for.
                count: ({ where }: { where: { id: { in: string[] }; userId: string } }) =>
                    Promise.resolve(
                        db.collections.filter(
                            (candidate) =>
                                where.id.in.includes(candidate.id) &&
                                candidate.userId === where.userId,
                        ).length,
                    ),
            },
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
                // The free-tier cap's count. Scoped to the caller for the same reason every other
                // matcher here is: a count that ignored `userId` would let one account's items push
                // another account over the limit.
                count: ({ where }: { where: { userId: string } }) =>
                    Promise.resolve(
                        db.items.filter((candidate) => candidate.userId === where.userId).length,
                    ),
                create: ({ data }: { data: CreateData }) => {
                    db.lastCreateCollections = data.collections;

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
                // Reads the same way `update` writes, so the ownership tests cover this call too:
                // drop `userId` from the query and it starts finding the other user's row.
                findFirst: ({ where }: { where: ItemWhere }) => {
                    const row = match(where);

                    return Promise.resolve(
                        // `snippet` by default, so the tests that are about ownership rather than
                        // about columns can keep declaring a row with nothing but an id and a title.
                        row ? { itemType: { name: row.itemTypeName ?? "snippet" } } : null,
                    );
                },
                update: ({ where, data }: { where: ItemWhere; data: Record<string, unknown> }) => {
                    const row = match(where);

                    if (!row) return notFound();

                    db.lastUpdateData = data;

                    // Applied to the row, not only recorded: `toggleItemFavorite` returns the value
                    // Postgres ends up holding rather than the one it sent, so a fake that never
                    // wrote anything would let that distinction pass untested.
                    Object.assign(row, data);

                    return Promise.resolve(row);
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

const { createItem, deleteItem, toggleItemFavorite, toggleItemPin, updateItem } =
    await import("./items");

describe("createItem", () => {
    beforeEach(() => {
        db.items = [];
        db.lastCreateCollections = null;
        db.collections = [
            { id: "collection-mine", userId: "user-owner" },
            { id: "collection-theirs", userId: "user-other" },
        ];
        // The custom type comes first, so a `findFirst` that stopped filtering on `userId` would
        // return it — which is the bug the `name`-alone lookup in `schema.prisma`'s note describes.
        db.itemTypes = [
            { id: "type-custom-snippet", name: "snippet", userId: "user-owner" },
            { id: "type-snippet", name: "snippet", userId: null },
            { id: "type-link", name: "link", userId: null },
            { id: "type-image", name: "image", userId: null },
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

    /**
     * `Item.fileName` is not decoration: `isInlineDisposition` reads it to decide whether
     * `GET /api/files/[id]` answers `inline`, while the media type comes from the stored object. An
     * allowed `.svg` upload renamed to `.png` in the payload would therefore be served as
     * `image/svg+xml` inline on this origin — script included, and `nosniff` no help, because the
     * declared type is the truth about those bytes. The key carries the real extension, so these
     * pin the name to the object it claims to be.
     */
    const SVG_KEY = "users/user-owner/11111111-2222-3333-4444-555555555555.svg";

    it("refuses a filename whose extension is not the uploaded object's", async () => {
        await expect(
            createItem({
                type: "image",
                title: "Shot",
                fileKey: SVG_KEY,
                fileName: "shot.png",
                fileSize: 100,
            }),
        ).resolves.toMatchObject({ success: false });

        expect(db.items).toHaveLength(0);
    });

    it("accepts a filename that agrees with the uploaded object", async () => {
        const result = await createItem({
            type: "image",
            title: "Shot",
            fileKey: SVG_KEY,
            fileName: "shot.svg",
            fileSize: 100,
        });

        expect(result.success).toBe(true);
    });

    it("rejects an invalid payload before reaching the database", async () => {
        await expect(createItem({ type: "link", title: "Docs" })).resolves.toMatchObject({
            success: false,
            fields: { url: "URL is required." },
        });
        expect(db.items).toHaveLength(0);
    });

    it("files the new item into the collections it names", async () => {
        const result = await createItem({
            type: "snippet",
            title: "My snippet",
            collectionIds: ["collection-mine"],
        });

        expect(result.success).toBe(true);
        expect(db.lastCreateCollections).toEqual({
            create: [{ collectionId: "collection-mine" }],
        });
    });

    /**
     * `ItemCollection` has no `userId` of its own, so nothing downstream of this check would notice:
     * the insert succeeds, and the item shows up on a stranger's collection page. The ids are chosen
     * from a list this account was served and then posted back, which makes them client input again
     * by the time they arrive — the same reason `fileKey` is re-checked.
     */
    it("refuses to file the item into another user's collection", async () => {
        await expect(
            createItem({
                type: "snippet",
                title: "My snippet",
                collectionIds: ["collection-mine", "collection-theirs"],
            }),
        ).resolves.toMatchObject({ success: false });

        expect(db.items).toHaveLength(0);
    });

    it("answers a collection that does not exist the same way, so neither confirms the other", async () => {
        await expect(
            createItem({
                type: "snippet",
                title: "My snippet",
                collectionIds: ["collection-nonexistent"],
            }),
        ).resolves.toMatchObject({
            success: false,
            error: "One of those collections no longer exists.",
        });

        expect(db.items).toHaveLength(0);
    });
});

describe("updateItem", () => {
    beforeEach(() => {
        db.items = [];
        db.lastUpdateData = null;
        db.collections = [
            { id: "collection-mine", userId: "user-owner" },
            { id: "collection-theirs", userId: "user-other" },
        ];
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

    /**
     * The other half of the rule the two toggle blocks assert from the outside: this is the one write
     * path that *does* move `editedAt`. Without it the column would only ever hold its creation
     * default, every listing would freeze in creation order, and nothing would fail.
     */
    it("stamps editedAt, which is what the recency listings order by", async () => {
        db.items = [{ id: "item-1", userId: "user-owner", title: "My snippet" }];
        const before = Date.now();

        await updateItem("item-1", { title: "Renamed" });

        expect(db.lastUpdateData?.editedAt).toBeInstanceOf(Date);
        expect((db.lastUpdateData?.editedAt as Date).getTime()).toBeGreaterThanOrEqual(before);
    });

    /**
     * The edit form renders only the fields a type owns, so these payloads are ones only a
     * hand-made request produces. That is the point: without the strip, the form's field list is the
     * only thing keeping a URL out of a snippet's `url` column — and an item whose `contentType` says
     * TEXT while `url` is populated renders as a link in the drawer, with no field in the UI to
     * clear it again. `createItem` has always stripped; this is the path that did not.
     */
    it("drops a content column the item's type does not own", async () => {
        db.items = [
            { id: "item-1", userId: "user-owner", title: "My snippet", itemTypeName: "snippet" },
        ];

        const result = await updateItem("item-1", {
            title: "Renamed",
            url: "https://evil.example",
        });

        expect(result.success).toBe(true);
        expect(db.lastUpdateData).toMatchObject({ title: "Renamed", url: undefined });
    });

    it("drops a language on a type whose content is not code", async () => {
        db.items = [{ id: "item-1", userId: "user-owner", title: "My note", itemTypeName: "note" }];

        const result = await updateItem("item-1", { title: "Renamed", language: "typescript" });

        expect(result.success).toBe(true);
        expect(db.lastUpdateData).toMatchObject({ content: undefined, language: undefined });
    });

    it("writes the columns the type does own", async () => {
        db.items = [{ id: "item-1", userId: "user-owner", title: "My link", itemTypeName: "link" }];

        const result = await updateItem("item-1", {
            title: "Renamed",
            url: "https://example.com",
        });

        expect(result.success).toBe(true);
        expect(db.lastUpdateData).toMatchObject({
            title: "Renamed",
            url: "https://example.com",
        });
    });

    it("still writes code fields for a type that owns them", async () => {
        db.items = [
            { id: "item-1", userId: "user-owner", title: "My snippet", itemTypeName: "snippet" },
        ];

        const result = await updateItem("item-1", {
            title: "Renamed",
            content: "const a = 1;",
            language: "typescript",
        });

        expect(result.success).toBe(true);
        expect(db.lastUpdateData).toMatchObject({
            content: "const a = 1;",
            language: "typescript",
        });
    });

    describe("collections", () => {
        beforeEach(() => {
            db.items = [{ id: "item-1", userId: "user-owner", title: "My snippet" }];
        });

        it("replaces membership with exactly what was submitted", async () => {
            // Two halves over disjoint sets — drop what is no longer selected, insert what is newly
            // selected — rather than clear-and-reinsert, which would reset every row's `addedAt`.
            const result = await updateItem("item-1", {
                title: "Renamed",
                collectionIds: ["collection-mine"],
            });

            expect(result.success).toBe(true);
            expect(db.lastUpdateData?.collections).toEqual({
                deleteMany: { collectionId: { notIn: ["collection-mine"] } },
                createMany: {
                    data: [{ collectionId: "collection-mine" }],
                    skipDuplicates: true,
                },
            });
        });

        it("removes the item from every collection when the selection is empty", async () => {
            const result = await updateItem("item-1", { title: "Renamed", collectionIds: [] });

            expect(result.success).toBe(true);
            // An empty `where`, so "delete all of them" is stated rather than left to how a database
            // happens to treat `NOT IN ()`.
            expect(db.lastUpdateData?.collections).toEqual({
                deleteMany: {},
                createMany: undefined,
            });
        });

        it("leaves membership alone when the payload carries no list", async () => {
            // What the edit form submits when the collection list could not be loaded. Writing the
            // relation here would unfile the item from everything on a failed fetch.
            const result = await updateItem("item-1", { title: "Renamed" });

            expect(result.success).toBe(true);
            expect(db.lastUpdateData?.collections).toBeUndefined();
        });

        it("refuses to file the item into another user's collection", async () => {
            await expect(
                updateItem("item-1", { title: "Renamed", collectionIds: ["collection-theirs"] }),
            ).resolves.toMatchObject({
                success: false,
                error: "One of those collections no longer exists.",
            });

            expect(db.lastUpdateData).toBeNull();
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

describe("toggleItemFavorite", () => {
    beforeEach(() => {
        db.items = [];
        db.lastUpdateData = null;
    });

    it("refuses an item owned by another user, and leaves its state alone", async () => {
        db.items = [
            { id: "item-theirs", userId: "user-other", title: "Their snippet", isFavorite: false },
        ];

        await expect(toggleItemFavorite("item-theirs", true)).resolves.toEqual({
            success: false,
            error: "This item no longer exists.",
        });
        expect(db.items[0]?.isFavorite).toBe(false);
    });

    it("answers a missing item the same way, so the two are indistinguishable", async () => {
        await expect(toggleItemFavorite("item-nonexistent", true)).resolves.toEqual({
            success: false,
            error: "This item no longer exists.",
        });
    });

    it("writes the state it was given rather than flipping what it finds", async () => {
        // Already favourited, and asked to favourite again. A read-then-flip implementation would
        // write `false` here — which is what a double click on the star used to do to itself, and
        // the whole reason this action takes the state instead of deriving it.
        db.items = [{ id: "item-1", userId: "user-owner", title: "My snippet", isFavorite: true }];

        await expect(toggleItemFavorite("item-1", true)).resolves.toEqual({
            success: true,
            data: { isFavorite: true },
        });
        expect(db.items[0]?.isFavorite).toBe(true);
    });

    it("unfavourites when asked to", async () => {
        db.items = [{ id: "item-1", userId: "user-owner", title: "My snippet", isFavorite: true }];

        await expect(toggleItemFavorite("item-1", false)).resolves.toEqual({
            success: true,
            data: { isFavorite: false },
        });
        expect(db.items[0]?.isFavorite).toBe(false);
    });

    it("writes nothing but the flag", async () => {
        db.items = [{ id: "item-1", userId: "user-owner", title: "My snippet", isFavorite: false }];

        await toggleItemFavorite("item-1", true);

        // The star must not be able to touch a title, a body, or a type on its way past — nor
        // `editedAt`, which is the whole reason that column is written by hand instead of being
        // declared `@updatedAt`. An exact match rather than `toMatchObject`, so an extra key fails.
        expect(db.lastUpdateData).toEqual({ isFavorite: true });
    });
});

/**
 * The same five properties as the block above, on the other boolean. They are re-tested rather than
 * assumed to follow: the two actions share a shape, not an implementation, and the ownership `where`
 * is exactly the kind of thing a copied function loses.
 */
describe("toggleItemPin", () => {
    beforeEach(() => {
        db.items = [];
        db.lastUpdateData = null;
    });

    it("refuses an item owned by another user, and leaves its state alone", async () => {
        db.items = [
            { id: "item-theirs", userId: "user-other", title: "Their snippet", isPinned: false },
        ];

        await expect(toggleItemPin("item-theirs", true)).resolves.toEqual({
            success: false,
            error: "This item no longer exists.",
        });
        expect(db.items[0]?.isPinned).toBe(false);
    });

    it("answers a missing item the same way, so the two are indistinguishable", async () => {
        await expect(toggleItemPin("item-nonexistent", true)).resolves.toEqual({
            success: false,
            error: "This item no longer exists.",
        });
    });

    it("writes the state it was given rather than flipping what it finds", async () => {
        db.items = [{ id: "item-1", userId: "user-owner", title: "My snippet", isPinned: true }];

        await expect(toggleItemPin("item-1", true)).resolves.toEqual({
            success: true,
            data: { isPinned: true },
        });
        expect(db.items[0]?.isPinned).toBe(true);
    });

    it("unpins when asked to", async () => {
        db.items = [{ id: "item-1", userId: "user-owner", title: "My snippet", isPinned: true }];

        await expect(toggleItemPin("item-1", false)).resolves.toEqual({
            success: true,
            data: { isPinned: false },
        });
        expect(db.items[0]?.isPinned).toBe(false);
    });

    /**
     * `pinnedAt` has to move with the flag, in the same statement. The dashboard's Pinned section
     * orders by it and filters on `isPinned`, so a row where the two disagree either sorts as though
     * it were pinned long ago or, on an unpin that left the timestamp behind, comes back to its old
     * position when re-pinned instead of to the top. Nothing in the schema can state that
     * invariant — this one write is what upholds it.
     */
    it("stamps pinnedAt alongside the flag, and clears it on unpin", async () => {
        db.items = [{ id: "item-1", userId: "user-owner", title: "My snippet", isPinned: false }];
        const before = Date.now();

        await toggleItemPin("item-1", true);

        expect(db.lastUpdateData?.pinnedAt).toBeInstanceOf(Date);
        expect((db.lastUpdateData?.pinnedAt as Date).getTime()).toBeGreaterThanOrEqual(before);

        await toggleItemPin("item-1", false);

        expect(db.lastUpdateData).toEqual({ isPinned: false, pinnedAt: null });
    });

    it("writes nothing but the flag and its timestamp", async () => {
        db.items = [
            {
                id: "item-1",
                userId: "user-owner",
                title: "My snippet",
                isPinned: false,
                isFavorite: true,
            },
        ];

        await toggleItemPin("item-1", true);

        // In particular not `isFavorite`: the two toggles sit next to each other in the drawer's
        // toolbar and write the same row, and neither may carry the other's state along. And not
        // `editedAt` either — pinning is not editing, which is what keeps a pinned item from
        // reappearing at the top of the dashboard's recent list the moment it is unpinned.
        expect(db.lastUpdateData).toEqual({ isPinned: true, pinnedAt: expect.any(Date) });
        expect(db.items[0]?.isFavorite).toBe(true);
    });
});
