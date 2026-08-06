import { describe, expect, it } from "vitest";

import { buildObjectKey, isOwnedKey } from "./r2";

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
