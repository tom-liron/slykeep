import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The S3 client is faked rather than reached, so `deleteUserObjects` can be asked the questions that
 * matter about a bulk delete — which prefix it swept, how it paginated, and whether it stops — without
 * a bucket. Everything above it is a pure function and needs no mock at all.
 */
const s3 = vi.hoisted(() => ({
    /** Every command the code sent, in order, so the pagination can be asserted on. */
    sent: [] as { type: "list" | "delete"; input: Record<string, unknown> }[],
    /** The `ListObjectsV2` responses to hand back, one per call. */
    listPages: [] as {
        Contents?: { Key?: string }[];
        IsTruncated?: boolean;
        NextContinuationToken?: string;
    }[],
    /** The `Errors` array each `DeleteObjects` answers with, one per call. */
    deleteErrors: [] as { Key: string }[][],
}));

vi.mock("@aws-sdk/client-s3", () => {
    class Command {
        constructor(readonly input: Record<string, unknown>) {}
    }

    class ListObjectsV2Command extends Command {}
    class DeleteObjectsCommand extends Command {}

    class S3Client {
        send(command: Command) {
            if (command instanceof ListObjectsV2Command) {
                s3.sent.push({ type: "list", input: command.input });

                return Promise.resolve(s3.listPages.shift() ?? {});
            }

            if (command instanceof DeleteObjectsCommand) {
                s3.sent.push({ type: "delete", input: command.input });

                return Promise.resolve({ Errors: s3.deleteErrors.shift() ?? [] });
            }

            return Promise.reject(new Error("Unexpected command"));
        }
    }

    return {
        S3Client,
        ListObjectsV2Command,
        DeleteObjectsCommand,
        // Unused here, but the module under test imports them.
        DeleteObjectCommand: class extends Command {},
        GetObjectCommand: class extends Command {},
        PutObjectCommand: class extends Command {},
    };
});

import { buildObjectKey, deleteUserObjects, isOwnedKey } from "./r2";

const USER = "clx0000000000000000000000";

describe("buildObjectKey", () => {
    it("scopes the key to the user and keeps the extension", () => {
        expect(buildObjectKey(USER, "diagram.png")).toMatch(
            new RegExp(`^users/${USER}/[0-9a-f-]{36}\\.png$`),
        );
    });

    it("does not carry the original filename into the key", () => {
        // The name is persisted in `Item.fileName` instead. A key derived from user input is a key
        // an attacker gets to influence, and it has to be un-parsed later to name a download.
        expect(buildObjectKey(USER, "quarterly report (final).pdf")).not.toContain("report");
    });

    it("lowercases the extension, and copes with a name that has none", () => {
        expect(buildObjectKey(USER, "SHOT.PNG")).toMatch(/\.png$/);
        expect(buildObjectKey(USER, "Makefile")).toMatch(
            new RegExp(`^users/${USER}/[0-9a-f-]{36}$`),
        );
    });

    it("produces a different key every time", () => {
        expect(buildObjectKey(USER, "a.png")).not.toBe(buildObjectKey(USER, "a.png"));
    });

    it("builds keys that pass its own ownership check", () => {
        expect(isOwnedKey(buildObjectKey(USER, "a.png"), USER)).toBe(true);
        expect(isOwnedKey(buildObjectKey(USER, "Makefile"), USER)).toBe(true);
    });
});

describe("isOwnedKey", () => {
    const key = `users/${USER}/3f0c9c1e-0000-4000-8000-00000000abcd.png`;

    it("rejects another user's object", () => {
        // The whole reason this exists: the upload route hands a key to the browser, and the browser
        // hands it back with the create payload, so by then it is client input again.
        expect(isOwnedKey(key, "clx1111111111111111111111")).toBe(false);
    });

    it("rejects a traversal out of the user's prefix", () => {
        // `startsWith` alone would accept this, and the `..` normalizes away once a key reaches a
        // URL — which is how a prefix check becomes no check at all.
        expect(isOwnedKey(`users/${USER}/../victim/${"a".repeat(36)}.png`, USER)).toBe(false);
    });

    it("rejects a key that is not a UUID under the prefix", () => {
        expect(isOwnedKey(`users/${USER}/notes.png`, USER)).toBe(false);
        expect(
            isOwnedKey(`users/${USER}/sub/dir/3f0c9c1e-0000-4000-8000-00000000abcd.png`, USER),
        ).toBe(false);
    });

    it("rejects a prefix that merely starts with the user's id", () => {
        // Without the trailing slash, "users/abc" would also match "users/abcdef/...".
        expect(
            isOwnedKey(`users/${USER}extra/3f0c9c1e-0000-4000-8000-00000000abcd.png`, USER),
        ).toBe(false);
    });

    it("accepts the user's own key", () => {
        expect(isOwnedKey(key, USER)).toBe(true);
    });
});

describe("deleteUserObjects", () => {
    const key = (n: number) =>
        `users/${USER}/3f0c9c1e-0000-4000-8000-${String(n).padStart(12, "0")}.png`;

    beforeEach(() => {
        s3.sent = [];
        s3.listPages = [];
        s3.deleteErrors = [];

        vi.stubEnv("R2_ACCOUNT_ID", "account");
        vi.stubEnv("R2_ACCESS_KEY_ID", "access-key");
        vi.stubEnv("R2_SECRET_ACCESS_KEY", "secret");
        vi.stubEnv("R2_BUCKET_NAME", "slykeep-test");
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it("deletes everything under the user's prefix, and asks for nothing else", () => {
        // The prefix is the whole authorization story for this sweep: the account's rows are already
        // gone by the time it runs, so a wrong prefix is a silent bulk delete of someone else's files.
        s3.listPages = [{ Contents: [{ Key: key(1) }, { Key: key(2) }] }];

        return deleteUserObjects(USER).then((deleted) => {
            expect(deleted).toBe(2);
            expect(s3.sent[0]).toMatchObject({
                type: "list",
                input: { Bucket: "slykeep-test", Prefix: `users/${USER}/` },
            });
            expect(s3.sent[1]).toMatchObject({
                type: "delete",
                input: { Delete: { Objects: [{ Key: key(1) }, { Key: key(2) }] } },
            });
        });
    });

    it("follows the continuation token until the listing is exhausted", async () => {
        s3.listPages = [
            { Contents: [{ Key: key(1) }], IsTruncated: true, NextContinuationToken: "page-2" },
            { Contents: [{ Key: key(2) }] },
        ];

        await expect(deleteUserObjects(USER)).resolves.toBe(2);

        expect(s3.sent.map((command) => command.type)).toEqual([
            "list",
            "delete",
            "list",
            "delete",
        ]);
        // The second listing has to carry the token, or the sweep silently stops at 1000 objects and
        // reports success for an account that still has files in the bucket.
        expect(s3.sent[2].input).toMatchObject({ ContinuationToken: "page-2" });
    });

    it("stops when a page says it is truncated but hands back no token", async () => {
        // Belt and braces against an infinite delete loop: `IsTruncated` alone must not keep it going.
        s3.listPages = [{ Contents: [{ Key: key(1) }], IsTruncated: true }];

        await expect(deleteUserObjects(USER)).resolves.toBe(1);
        expect(s3.sent.filter((command) => command.type === "list")).toHaveLength(1);
    });

    it("sends no delete at all for an account that uploaded nothing", async () => {
        s3.listPages = [{}];

        await expect(deleteUserObjects(USER)).resolves.toBe(0);
        expect(s3.sent.filter((command) => command.type === "delete")).toHaveLength(0);
    });

    it("finishes the sweep before raising a partial failure, and counts only what went", async () => {
        // One key R2 refuses must not strand the thousand behind it — the caller logs this and moves
        // on, so anything abandoned here is abandoned for good.
        s3.listPages = [
            {
                Contents: [{ Key: key(1) }, { Key: key(2) }],
                IsTruncated: true,
                NextContinuationToken: "page-2",
            },
            { Contents: [{ Key: key(3) }] },
        ];
        s3.deleteErrors = [[{ Key: key(2) }]];

        await expect(deleteUserObjects(USER)).rejects.toThrow(/refused to delete 1 object/);
        expect(s3.sent.filter((command) => command.type === "delete")).toHaveLength(2);
    });

    it("refuses a blank user id rather than sweeping a prefix nobody owns", async () => {
        await expect(deleteUserObjects("  ")).rejects.toThrow(/requires a user id/);
        expect(s3.sent).toHaveLength(0);
    });
});
