import { describe, expect, it } from "vitest";

import { SYSTEM_ITEM_TYPE_BY_ID, SYSTEM_ITEM_TYPE_CATALOG } from "@/config/item-type-catalog";
import type { CollectionViewModel, ItemSummaryViewModel } from "@/types/view-models";
import { collectionRecords, itemRecords } from "./records";
import type { MockCollectionRecord, MockItemRecord } from "./records";
import {
    buildCollectionViewModel,
    buildDashboardViewModel,
    buildItemSummaryViewModel,
    resolveDominantTypeId,
    sortByUpdatedAtDesc,
} from "./view-models";

const collection: MockCollectionRecord = {
    id: "collection",
    name: "Test collection",
    description: "Test",
    isFavorite: false,
    defaultTypeId: "type_note",
    updatedAt: "2026-01-01",
};

function makeItem(
    id: string,
    typeId: string,
    updatedAt: string,
    overrides: Partial<MockItemRecord> = {},
): MockItemRecord {
    return {
        id,
        title: id,
        description: "",
        typeId,
        content: "",
        tags: [],
        isFavorite: false,
        isPinned: false,
        collectionIds: [collection.id],
        updatedAt,
        ...overrides,
    };
}

describe("mock view models", () => {
    it("uses the most recently updated item to break dominant-type ties", () => {
        const items = [
            makeItem("snippet-old", "type_snippet", "2026-01-01"),
            makeItem("snippet-new", "type_snippet", "2026-01-03"),
            makeItem("prompt-old", "type_prompt", "2026-01-02"),
            makeItem("prompt-new", "type_prompt", "2026-01-04"),
        ];

        expect(resolveDominantTypeId(collection, items)).toBe("type_prompt");
    });

    it("uses the collection default type when the collection is empty", () => {
        expect(resolveDominantTypeId(collection, [])).toBe("type_note");
    });

    it("derives collection counts and contained types", () => {
        const viewModel = buildCollectionViewModel(
            collection,
            [
                makeItem("snippet", "type_snippet", "2026-01-01"),
                makeItem("prompt", "type_prompt", "2026-01-02"),
            ],
            SYSTEM_ITEM_TYPE_BY_ID,
        );

        expect(viewModel.itemCount).toBe(2);
        expect(viewModel.itemTypes.map((itemType) => itemType.id)).toEqual([
            "type_snippet",
            "type_prompt",
        ]);
    });

    it("sorts records by updatedAt without mutating the input", () => {
        const records = [
            { id: "older", updatedAt: "2026-01-01" },
            { id: "newer", updatedAt: "2026-01-02" },
        ];

        expect(sortByUpdatedAtDesc(records).map((record) => record.id)).toEqual(["newer", "older"]);
        expect(records[0].id).toBe("older");
    });

    it("builds item summaries without list-inaccessible content", () => {
        const summary = buildItemSummaryViewModel(
            makeItem("item", "type_snippet", "2026-01-01", { content: "private body" }),
            SYSTEM_ITEM_TYPE_BY_ID,
        );

        expect(summary).not.toHaveProperty("content");
    });

    it("keeps pinned items out of recent items and derives stats", () => {
        const snippetType = SYSTEM_ITEM_TYPE_CATALOG[0];
        const pinned = {
            id: "pinned",
            title: "Pinned",
            description: "",
            tags: [],
            isFavorite: true,
            isPinned: true,
            updatedAt: "2026-01-03",
            itemType: snippetType,
        } satisfies ItemSummaryViewModel;
        const recent = {
            ...pinned,
            id: "recent",
            title: "Recent",
            isFavorite: false,
            isPinned: false,
            updatedAt: "2026-01-02",
        } satisfies ItemSummaryViewModel;
        const collectionViewModel = {
            id: "collection",
            name: "Collection",
            description: "",
            isFavorite: true,
            updatedAt: "2026-01-01",
            itemCount: 2,
            itemTypes: [snippetType],
            dominantItemType: snippetType,
        } satisfies CollectionViewModel;

        const dashboard = buildDashboardViewModel([recent, pinned], [collectionViewModel]);

        expect(dashboard.pinnedItems.map((item) => item.id)).toEqual(["pinned"]);
        expect(dashboard.recentItems.map((item) => item.id)).toEqual(["recent"]);
        expect(dashboard.stats).toEqual({
            totalItems: 2,
            totalCollections: 1,
            favoriteItems: 1,
            favoriteCollections: 1,
        });
    });

    it("keeps all mock type references aligned with system configuration", () => {
        const itemTypeIds = itemRecords.map((item) => item.typeId);
        const defaultTypeIds = collectionRecords.map((record) => record.defaultTypeId);

        expect(
            [...itemTypeIds, ...defaultTypeIds].every((id) => SYSTEM_ITEM_TYPE_BY_ID.has(id)),
        ).toBe(true);
    });
});
