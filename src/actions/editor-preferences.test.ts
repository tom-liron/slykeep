import { beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_EDITOR_PREFERENCES } from "@/config/editor";

/**
 * Three properties this write must not get wrong.
 *
 * It saves to the signed-in account and to no account a payload names. Ownership lives in the
 * `where`, and there is nothing in the payload to compare it against — which is exactly why a
 * refactor that started taking a user id would still type-check and still pass every schema test.
 *
 * A payload the contract rejects never reaches the database. `editor-preferences.test.ts` in `lib/`
 * proves the schema refuses it; this proves the action stops there rather than validating and
 * writing anyway.
 *
 * Only the five declared keys are stored. The column is JSON, so an extra key does not fail a
 * constraint — it is simply kept, forever, and read back by `parseEditorPreferences` on every page
 * view. Zod's strip is what prevents that, and swapping `parsed.data` for the raw input would keep
 * every other test passing.
 *
 * Same in-memory stand-in as the collection and item action tests: the question is what the action
 * *asks* Prisma to do, not how Postgres answers.
 */

type UpdateArgs = { where: { id?: string }; data: Record<string, unknown> };

const db = vi.hoisted(() => ({
    // What the last `user.update` was asked to write and which row it aimed at, so a test can assert
    // on the keys left out as well as the ones sent.
    lastUpdate: null as UpdateArgs | null,
    // How many writes were attempted at all, which is what makes "did not reach the database" an
    // assertion rather than an absence.
    updates: 0,
    // Flipped by the test that needs the database to refuse.
    failNextUpdate: false,
}));

// The signed-in user is fixed: these tests vary the payload, not who is asking.
vi.mock("@/server/current-user", () => ({
    getCurrentUserId: () => Promise.resolve("user-owner"),
}));

vi.mock("@/lib/prisma", () => ({
    prisma: {
        user: {
            update: (args: UpdateArgs) => {
                db.updates += 1;
                db.lastUpdate = args;

                if (db.failNextUpdate) {
                    return Promise.reject(new Error("connection refused"));
                }

                return Promise.resolve({ id: args.where.id });
            },
        },
    },
}));

const { updateEditorPreferences } = await import("./editor-preferences");

beforeEach(() => {
    db.lastUpdate = null;
    db.updates = 0;
    db.failNextUpdate = false;
});

describe("updateEditorPreferences", () => {
    it("saves a valid set and reports success", async () => {
        const preferences = {
            fontSize: 16,
            tabSize: 4,
            wordWrap: false,
            minimap: true,
            theme: "monokai",
        };

        await expect(updateEditorPreferences(preferences)).resolves.toEqual({ success: true });
        expect(db.lastUpdate?.data.editorPreferences).toEqual(preferences);
    });

    it("writes to the signed-in account, which no payload can name", async () => {
        await updateEditorPreferences({ ...DEFAULT_EDITOR_PREFERENCES, userId: "user-victim" });

        expect(db.lastUpdate?.where).toEqual({ id: "user-owner" });
    });

    it("touches no column but the preferences", async () => {
        await updateEditorPreferences(DEFAULT_EDITOR_PREFERENCES);

        expect(Object.keys(db.lastUpdate?.data ?? {})).toEqual(["editorPreferences"]);
    });

    it("stores only the keys the contract declares", async () => {
        // A JSON column keeps whatever it is handed, so anything extra would be read back by
        // `parseEditorPreferences` on every page view from here on.
        await updateEditorPreferences({
            ...DEFAULT_EDITOR_PREFERENCES,
            isPro: true,
            lineNumbers: "off",
        });

        expect(db.lastUpdate?.data.editorPreferences).toEqual(DEFAULT_EDITOR_PREFERENCES);
    });

    describe("when the payload is rejected", () => {
        it("does not reach the database", async () => {
            await updateEditorPreferences({ ...DEFAULT_EDITOR_PREFERENCES, fontSize: 0 });

            expect(db.updates).toBe(0);
        });

        it("says so rather than failing silently", async () => {
            const result = await updateEditorPreferences({
                ...DEFAULT_EDITOR_PREFERENCES,
                theme: "solarized-dark",
            });

            expect(result).toEqual({ success: false, error: expect.any(String) });
        });

        it("refuses a partial set, since the action replaces the whole value", async () => {
            await updateEditorPreferences({ fontSize: 14 });

            expect(db.updates).toBe(0);
        });

        it("refuses a payload that is not an object at all", async () => {
            for (const payload of [null, undefined, "vs-dark", 13, []]) {
                await updateEditorPreferences(payload);
            }

            expect(db.updates).toBe(0);
        });
    });

    it("reports a database failure instead of throwing it at the panel", async () => {
        db.failNextUpdate = true;

        const result = await updateEditorPreferences(DEFAULT_EDITOR_PREFERENCES);

        expect(result.success).toBe(false);
    });
});
