import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CreateCollectionInput } from "@/lib/collection-schemas";

/**
 * The property under test is the one this write must not get wrong: the collection is owned by the
 * signed-in user, and by nobody the payload names. `createCollection` spreads `parsed.data` into
 * `prisma.collection.create`, so the guard is that Zod stripped the payload down to the two columns
 * the contract declares — change the spread to the raw `input` and every schema test still passes
 * while an attacker-supplied `userId` reaches the database.
 *
 * The write-side twin of the ownership tests in `items.test.ts`, and the same in-memory stand-in:
 * the question is what the action *asks* Prisma to write, not how Postgres answers. It is also the
 * one property clicking through the UI cannot check, since proving it by hand needs a hand-made
 * payload rather than the dialog, which can only ever submit two strings.
 */

type CollectionRow = { id: string; userId: string; name: string; description?: string | null };

/** What `createCollection` builds: the owner connected by id, never assigned as a column. */
type CreateData = {
    name: string;
    description?: string | null;
    user: { connect: { id: string } };
};

const db = vi.hoisted(() => ({
    collections: [] as CollectionRow[],
    // What the last `collection.create` was asked to write, so a test can assert on the keys that
    // were left out as well as the ones that were sent.
    lastCreateData: null as Record<string, unknown> | null,
    // Flipped by the one test that needs the database to refuse.
    failNextCreate: false,
}));

// The signed-in user is fixed: these tests vary what the payload claims, not who is asking.
vi.mock("@/server/current-user", () => ({
    getCurrentUserId: () => Promise.resolve("user-owner"),
}));

vi.mock("@/lib/prisma", () => ({
    prisma: {
        collection: {
            create: ({ data }: { data: CreateData }) => {
                db.lastCreateData = data as unknown as Record<string, unknown>;

                if (db.failNextCreate) {
                    return Promise.reject(new Error("connection refused"));
                }

                const row = {
                    id: `collection-${db.collections.length + 1}`,
                    // Read off the relation the action connected, so a test that asserts on this is
                    // asserting on what the action decided rather than on what it was handed.
                    userId: data.user.connect.id,
                    name: data.name,
                    description: data.description,
                };

                db.collections.push(row);

                return Promise.resolve({ id: row.id });
            },
        },
    },
}));

const { createCollection } = await import("./collections");

describe("createCollection", () => {
    beforeEach(() => {
        db.collections = [];
        db.lastCreateData = null;
        db.failNextCreate = false;
        vi.spyOn(console, "error").mockImplementation(() => {});
    });

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
