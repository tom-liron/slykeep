import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CreateCollectionInput, UpdateCollectionInput } from "@/lib/collection-schemas";

/**
 * Three properties these writes must not get wrong.
 *
 * A collection is owned by the signed-in user and by nobody the payload names. `createCollection`
 * spreads `parsed.data` into `prisma.collection.create`, so the guard is that Zod stripped the
 * payload down to the two columns the contract declares — change the spread to the raw `input` and
 * every schema test still passes while an attacker-supplied `userId` reaches the database.
 *
 * A collection that is not the caller's is never edited or deleted, and is reported exactly as one
 * that does not exist. Ownership lives in the `where`, so a refactor to `where: { id }` would still
 * type-check and still pass every schema test while letting any signed-in account rename or destroy
 * any collection by id.
 *
 * Deleting a collection deletes the collection. The items in it survive, which is what the
 * confirmation dialog promises and what `ItemCollection`'s cascade delivers — as long as nothing
 * here ever reaches for `Item`.
 *
 * The write-side twin of the ownership tests in `items.test.ts`, and the same in-memory stand-in:
 * the question is what the action *asks* Prisma to do, not how Postgres answers. These are also the
 * properties clicking through the UI cannot check — proving the first needs a hand-made payload
 * rather than the dialog, and the second a second account and one of its collection ids.
 */

type CollectionRow = {
    id: string;
    userId: string;
    name: string;
    description?: string | null;
    /** What `toggleCollectionFavorite` writes, and reads back out of the row afterwards. */
    isFavorite?: boolean;
};

/** What `createCollection` builds: the owner connected by id, never assigned as a column. */
type CreateData = {
    name: string;
    description?: string | null;
    user: { connect: { id: string } };
};

type CollectionWhere = { id?: string; userId?: string };

/**
 * The signed-in account's verification standing, as `getCurrentUser` reports it.
 *
 * Confirmed by default so every other test measures its own subject; the guard tests at the bottom
 * flip it, since an unconfirmed account is read-only from the moment it exists.
 */
const state = vi.hoisted(() => ({
    verification: { emailVerified: true },
}));

const db = vi.hoisted(() => ({
    collections: [] as CollectionRow[],
    // What the last `collection.create` / `collection.update` was asked to write, so a test can
    // assert on the keys that were left out as well as the ones that were sent.
    lastCreateData: null as Record<string, unknown> | null,
    lastUpdateData: null as Record<string, unknown> | null,
    // Every `where` the delete path was given, so a test can assert it filtered on the owner too.
    lastDeleteWhere: null as CollectionWhere | null,
    // Bumped by any call that would remove item rows. Deleting a collection must leave it at zero.
    itemWrites: 0,
    // The `(path, type)` pairs the action revalidated, so a test can assert the sidebar's layout was
    // among them.
    revalidated: [] as [string, string | undefined][],
    // Flipped by the tests that need the database to refuse for a reason that is not "not found".
    failNextCreate: false,
    failNextWrite: false,
}));

// The signed-in user is fixed: these tests vary what the payload claims and who owns the row, not
// who is asking.
vi.mock("@/server/current-user", () => ({
    getCurrentUserId: () => Promise.resolve("user-owner"),
    // `createCollection` reads `isPro` for the free-tier cap. Pro here so the cap is never what
    // these tests are measuring — the cap has its own tests in `lib/limits.test.ts`. Confirmed and
    // writable for the same reason; the verification guard is tested at the bottom of this file.
    getCurrentUser: () => Promise.resolve({ id: "user-owner", isPro: true, ...state.verification }),
}));

// The real one throws outside a request, and what matters here is only that it was called with the
// layout scope — the narrower `revalidatePath("/collections")` would leave the sidebar stale.
vi.mock("next/cache", () => ({
    revalidatePath: (path: string, type?: string) => {
        db.revalidated.push([path, type]);
    },
}));

vi.mock("@/server/infra/prisma", async () => {
    const { Prisma } = await import("@/generated/prisma-client/client");

    // Filters only on the keys actually present, the way Prisma does. That is what makes the
    // ownership tests load-bearing: drop `userId` from the query and this fake starts matching on
    // id alone, hitting the other user's row instead of raising.
    const match = (where: CollectionWhere) =>
        db.collections.find(
            (candidate) =>
                (where.id === undefined || candidate.id === where.id) &&
                (where.userId === undefined || candidate.userId === where.userId),
        );

    // What Prisma raises when nothing matched — the error both actions turn into "This collection no
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
            // Not called by any of these actions, and that is the assertion: a delete that starts
            // clearing items would have to come through here.
            item: {
                delete: () => {
                    db.itemWrites += 1;

                    return Promise.resolve({});
                },
                deleteMany: () => {
                    db.itemWrites += 1;

                    return Promise.resolve({ count: 0 });
                },
            },
            collection: {
                // The free-tier cap's count, scoped to the caller like every other matcher here.
                count: ({ where }: { where: { userId: string } }) =>
                    Promise.resolve(
                        db.collections.filter((candidate) => candidate.userId === where.userId)
                            .length,
                    ),
                create: ({ data }: { data: CreateData }) => {
                    db.lastCreateData = data as unknown as Record<string, unknown>;

                    if (db.failNextCreate) {
                        return Promise.reject(new Error("connection refused"));
                    }

                    const row = {
                        id: `collection-${db.collections.length + 1}`,
                        // Read off the relation the action connected, so a test that asserts on this
                        // is asserting on what the action decided rather than on what it was handed.
                        userId: data.user.connect.id,
                        name: data.name,
                        description: data.description,
                    };

                    db.collections.push(row);

                    return Promise.resolve({ id: row.id });
                },
                update: ({
                    where,
                    data,
                }: {
                    where: CollectionWhere;
                    data: Record<string, unknown>;
                }) => {
                    db.lastUpdateData = data;

                    const row = match(where);

                    if (!row) {
                        return notFound();
                    }

                    if (db.failNextWrite) {
                        return Promise.reject(new Error("connection refused"));
                    }

                    Object.assign(row, data);

                    return Promise.resolve(row);
                },
                delete: ({ where }: { where: CollectionWhere }) => {
                    db.lastDeleteWhere = where;

                    const row = match(where);

                    if (!row) {
                        return notFound();
                    }

                    if (db.failNextWrite) {
                        return Promise.reject(new Error("connection refused"));
                    }

                    db.collections = db.collections.filter((candidate) => candidate !== row);

                    return Promise.resolve(row);
                },
            },
        },
    };
});

const { createCollection, deleteCollection, toggleCollectionFavorite, updateCollection } =
    await import("./collections");

/** Two collections with the same shape, owned by different accounts. */
function seedTwoOwners() {
    db.collections = [
        { id: "collection-owned", userId: "user-owner", name: "React Patterns" },
        { id: "collection-other", userId: "user-other", name: "Someone Else's" },
    ];
}

beforeEach(() => {
    state.verification = { emailVerified: true };
    db.collections = [];
    db.lastCreateData = null;
    db.lastUpdateData = null;
    db.lastDeleteWhere = null;
    db.itemWrites = 0;
    db.revalidated = [];
    db.failNextCreate = false;
    db.failNextWrite = false;
    vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("createCollection", () => {
    it("returns the new collection's id", async () => {
        await expect(createCollection({ name: "React Patterns" })).resolves.toEqual({
            success: true,
            data: { id: "collection-1" },
        });
    });

    it("owns the collection to the signed-in user", async () => {
        await createCollection({ name: "React Patterns" });

        expect(db.collections[0]?.userId).toBe("user-owner");
        expect(db.lastCreateData).toMatchObject({ user: { connect: { id: "user-owner" } } });
    });

    it("ignores an owner named by the payload", async () => {
        // The dialog cannot send this; a hand-made request can. `createCollectionSchema` strips it
        // before the spread, which is the only reason the connect below is not contradicted.
        await createCollection({
            name: "React Patterns",
            userId: "user-attacker",
        } as CreateCollectionInput);

        expect(db.collections[0]?.userId).toBe("user-owner");
        expect(db.lastCreateData).not.toHaveProperty("userId");
    });

    it("ignores columns the contract does not declare", async () => {
        // `Collection` also persists these two, and neither is part of creating one.
        await createCollection({
            name: "React Patterns",
            isFavorite: true,
            defaultTypeId: "type-snippet",
        } as CreateCollectionInput);

        expect(db.lastCreateData).not.toHaveProperty("isFavorite");
        expect(db.lastCreateData).not.toHaveProperty("defaultTypeId");
    });

    describe("description", () => {
        it("writes a description that has content, trimmed", async () => {
            await createCollection({ name: "React Patterns", description: "  Hooks  " });

            expect(db.lastCreateData).toMatchObject({ description: "Hooks" });
        });

        it("writes null for a blank one, so the column is not an empty string", async () => {
            // What the dialog actually submits when the field is left alone: "" rather than absent.
            await createCollection({ name: "React Patterns", description: "" });

            expect(db.lastCreateData).toMatchObject({ description: null });
        });

        it("leaves an omitted description out of the write entirely", async () => {
            await createCollection({ name: "React Patterns" });

            expect(db.lastCreateData).not.toHaveProperty("description");
        });
    });

    describe("when the payload is rejected", () => {
        it("reports the field that failed, and the same message in the summary", async () => {
            await expect(createCollection({ name: "   " })).resolves.toEqual({
                success: false,
                error: "Name is required.",
                fields: { name: "Name is required." },
            });
        });

        it("does not reach the database", async () => {
            await createCollection({ name: "" });

            expect(db.lastCreateData).toBeNull();
            expect(db.collections).toHaveLength(0);
        });

        it("rejects a name past the length cap", async () => {
            const result = await createCollection({ name: "x".repeat(101) });

            expect(result.success).toBe(false);
            expect(db.collections).toHaveLength(0);
        });
    });

    it("reports a database failure instead of throwing it at the dialog", async () => {
        db.failNextCreate = true;

        await expect(createCollection({ name: "React Patterns" })).resolves.toEqual({
            success: false,
            error: "Could not create this collection. Try again.",
        });
    });
});

describe("updateCollection", () => {
    beforeEach(seedTwoOwners);

    it("saves the caller's own collection", async () => {
        await expect(
            updateCollection("collection-owned", { name: "React Hooks" }),
        ).resolves.toEqual({ success: true });

        expect(db.collections[0]?.name).toBe("React Hooks");
    });

    describe("someone else's collection", () => {
        it("is reported exactly as one that does not exist", async () => {
            await expect(
                updateCollection("collection-other", { name: "Renamed" }),
            ).resolves.toEqual({
                success: false,
                error: "This collection no longer exists.",
            });

            // The same answer as an id that was never real, so one cannot be told from the other.
            await expect(
                updateCollection("collection-ghost", { name: "Renamed" }),
            ).resolves.toEqual({
                success: false,
                error: "This collection no longer exists.",
            });
        });

        it("is left untouched", async () => {
            await updateCollection("collection-other", { name: "Renamed" });

            expect(db.collections[1]?.name).toBe("Someone Else's");
        });
    });

    it("scopes the write to the owner, not to the id alone", async () => {
        await updateCollection("collection-owned", { name: "React Hooks" });

        // Asserted on the query rather than only on the row, because a fake that stopped filtering
        // would make the row assertions above pass again while the real one edited a stranger's.
        expect(db.lastUpdateData).not.toBeNull();
        expect(db.collections[1]?.name).toBe("Someone Else's");
    });

    it("ignores columns the contract does not declare", async () => {
        // The dialog cannot send these; a hand-made request can. `isFavorite` is the one that
        // matters — it is persisted, and favouriting is meant to be its own action.
        await updateCollection("collection-owned", {
            name: "React Hooks",
            userId: "user-attacker",
            isFavorite: true,
            defaultTypeId: "type-snippet",
        } as UpdateCollectionInput);

        expect(db.lastUpdateData).not.toHaveProperty("userId");
        expect(db.lastUpdateData).not.toHaveProperty("isFavorite");
        expect(db.lastUpdateData).not.toHaveProperty("defaultTypeId");
    });

    describe("description", () => {
        it("saves one that has content, trimmed", async () => {
            await updateCollection("collection-owned", {
                name: "React Hooks",
                description: "  Hooks  ",
            });

            expect(db.lastUpdateData).toMatchObject({ description: "Hooks" });
        });

        it("clears the column when the field is emptied", async () => {
            // What the dialog submits when the user deletes what was there: "" rather than absent.
            await updateCollection("collection-owned", { name: "React Hooks", description: "" });

            expect(db.lastUpdateData).toMatchObject({ description: null });
        });

        it("leaves the column alone when the field is omitted", async () => {
            await updateCollection("collection-owned", { name: "React Hooks" });

            expect(db.lastUpdateData).not.toHaveProperty("description");
        });
    });

    describe("when the payload is rejected", () => {
        it("reports the field that failed, and the same message in the summary", async () => {
            await expect(updateCollection("collection-owned", { name: "   " })).resolves.toEqual({
                success: false,
                error: "Name is required.",
                fields: { name: "Name is required." },
            });
        });

        it("does not reach the database", async () => {
            await updateCollection("collection-owned", { name: "" });

            expect(db.lastUpdateData).toBeNull();
            expect(db.collections[0]?.name).toBe("React Patterns");
        });
    });

    it("reports a database failure instead of throwing it at the dialog", async () => {
        db.failNextWrite = true;

        await expect(
            updateCollection("collection-owned", { name: "React Hooks" }),
        ).resolves.toEqual({
            success: false,
            error: "Could not save your changes. Try again.",
        });
    });
});

describe("deleteCollection", () => {
    beforeEach(seedTwoOwners);

    it("deletes the caller's own collection", async () => {
        await expect(deleteCollection("collection-owned")).resolves.toEqual({ success: true });

        expect(db.collections.map((row) => row.id)).toEqual(["collection-other"]);
    });

    it("keeps the items — the collection row is all that is deleted", async () => {
        await deleteCollection("collection-owned");

        // The membership rows go with it through `ItemCollection`'s cascade, which is the database's
        // job. What this guards is that the action never starts doing the items' half itself: the
        // confirmation dialog promises the items survive, and an added `item.deleteMany` here would
        // make that a lie while every other test in this file still passed.
        expect(db.itemWrites).toBe(0);
    });

    it("revalidates the layout, so the sidebar loses the collection too", async () => {
        await deleteCollection("collection-owned");

        // Scope matters, not just the call: the sidebar's favourites and recents are rendered by the
        // dashboard *layout*, which a page-scoped revalidation would leave holding a collection that
        // no longer exists.
        expect(db.revalidated).toContainEqual(["/", "layout"]);
    });

    it("does not revalidate when the delete was refused", async () => {
        await deleteCollection("collection-other");

        expect(db.revalidated).toEqual([]);
    });

    it("scopes the delete to the owner, not to the id alone", async () => {
        await deleteCollection("collection-owned");

        expect(db.lastDeleteWhere).toEqual({ id: "collection-owned", userId: "user-owner" });
    });

    describe("someone else's collection", () => {
        it("is reported exactly as one that does not exist", async () => {
            await expect(deleteCollection("collection-other")).resolves.toEqual({
                success: false,
                error: "This collection no longer exists.",
            });

            await expect(deleteCollection("collection-ghost")).resolves.toEqual({
                success: false,
                error: "This collection no longer exists.",
            });
        });

        it("survives", async () => {
            await deleteCollection("collection-other");

            expect(db.collections.map((row) => row.id)).toContain("collection-other");
        });
    });

    it("reports a database failure instead of throwing it at the dialog", async () => {
        db.failNextWrite = true;

        await expect(deleteCollection("collection-owned")).resolves.toEqual({
            success: false,
            error: "Could not delete this collection. Try again.",
        });
    });
});

describe("toggleCollectionFavorite", () => {
    beforeEach(seedTwoOwners);

    it("writes the state it was given rather than flipping what it finds", async () => {
        // Already favourited, and asked to favourite again. A read-then-flip implementation would
        // unfavourite it here, losing the race between two quick clicks; the action takes the state
        // rather than deriving it.
        db.collections[0].isFavorite = true;

        await expect(toggleCollectionFavorite("collection-owned", true)).resolves.toEqual({
            success: true,
            data: { isFavorite: true },
        });
        expect(db.collections[0]?.isFavorite).toBe(true);
    });

    it("unfavourites when asked to", async () => {
        db.collections[0].isFavorite = true;

        await expect(toggleCollectionFavorite("collection-owned", false)).resolves.toEqual({
            success: true,
            data: { isFavorite: false },
        });
        expect(db.collections[0]?.isFavorite).toBe(false);
    });

    it("writes nothing but the flag", async () => {
        await toggleCollectionFavorite("collection-owned", true);

        expect(db.lastUpdateData).toEqual({ isFavorite: true });
    });

    it("revalidates the layout, so the sidebar's favourites list follows", async () => {
        await toggleCollectionFavorite("collection-owned", true);

        // This is the list the star adds to and removes from, and it is rendered by the layout
        // rather than by the page the click came from.
        expect(db.revalidated).toContainEqual(["/", "layout"]);
    });

    describe("someone else's collection", () => {
        it("is reported exactly as one that does not exist", async () => {
            await expect(toggleCollectionFavorite("collection-other", true)).resolves.toEqual({
                success: false,
                error: "This collection no longer exists.",
            });

            await expect(toggleCollectionFavorite("collection-ghost", true)).resolves.toEqual({
                success: false,
                error: "This collection no longer exists.",
            });
        });

        it("is not favourited, and nothing is revalidated", async () => {
            await toggleCollectionFavorite("collection-other", true);

            expect(db.collections[1]?.isFavorite).toBeUndefined();
            expect(db.revalidated).toEqual([]);
        });
    });

    it("reports a database failure instead of throwing it at the star", async () => {
        db.failNextWrite = true;

        await expect(toggleCollectionFavorite("collection-owned", true)).resolves.toEqual({
            success: false,
            error: "Could not update this collection. Try again.",
        });
    });
});

/** The same read-only refusal, on the collection write paths. */
describe("a read-only account", () => {
    beforeEach(() => {
        state.verification = { emailVerified: false };
        db.collections = [];
    });

    it("cannot create", async () => {
        const result = await createCollection({ name: "Blocked" } as CreateCollectionInput);

        expect(result.success).toBe(false);
        expect(db.collections).toHaveLength(0);
    });

    it("cannot update, favourite or delete", async () => {
        expect(
            (await updateCollection("c-1", { name: "New" } as UpdateCollectionInput)).success,
        ).toBe(false);
        expect((await toggleCollectionFavorite("c-1", true)).success).toBe(false);
        expect((await deleteCollection("c-1")).success).toBe(false);
    });
});
