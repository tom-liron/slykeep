import { describe, expect, it } from "vitest";

import { FREE_COLLECTION_LIMIT, FREE_ITEM_LIMIT } from "@/lib/limits";
import { normalizeTagName } from "@/lib/item-schemas";
import {
    STARTER_COLLECTIONS,
    STARTER_UNFILED_ITEMS,
    uniqueTags,
    type StarterItem,
} from "./starter-content";

/**
 * Two rules the compiler cannot see. The fixtures are seeded into every new account and count
 * against that account's free-tier entitlement, so their *size* is a constraint rather than a
 * preference — a third collection added here would leave a new user unable to create one of their
 * own, and nothing else in the build would notice. `uniqueTags` is the other: it decides how many
 * `Tag` rows a seed attempts, and one row per spelling rather than per normalized form violates
 * `@@unique([userId, normalized])` at write time.
 */

const allItems = [
    ...STARTER_COLLECTIONS.flatMap((collection) => collection.items),
    ...STARTER_UNFILED_ITEMS,
];

const item = (tags: string[]): StarterItem => ({
    title: "t",
    type: "snippet",
    description: "d",
    body: "b",
    tags,
});

describe("starter content size", () => {
    it("leaves a free account a collection slot of its own", () => {
        expect(STARTER_COLLECTIONS.length).toBeLessThan(FREE_COLLECTION_LIMIT);
    });

    it("stays well below the free item ceiling", () => {
        expect(allItems.length).toBeLessThan(FREE_ITEM_LIMIT);
    });

    it("covers every free item type, so no type page opens empty", () => {
        const types = new Set(allItems.map((seeded) => seeded.type));

        expect([...types].sort()).toEqual(["command", "link", "prompt", "snippet"]);
    });
});

describe("uniqueTags", () => {
    it("collapses spellings that differ only by case, keeping the first seen", () => {
        expect(uniqueTags([item(["React"]), item(["react", "Hooks"])])).toEqual(["React", "Hooks"]);
    });

    it("collapses across an item's own tags too", () => {
        expect(uniqueTags([item(["react", "REACT"])])).toEqual(["react"]);
    });

    it("returns one entry per normalized form of the real fixtures", () => {
        const names = uniqueTags(allItems);

        expect(new Set(names.map(normalizeTagName)).size).toBe(names.length);
    });
});
