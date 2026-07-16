import { describe, expect, it } from "vitest";

import { ITEM_TYPE_CATALOG } from "@/config/item-type-catalog";
import type { ItemTypeName } from "@/types/item-type";
import { collectionRecords, itemRecords, itemTypeRecords } from "./mock-data/records";
import type { MockCollectionRecord, MockItemRecord } from "./mock-data/records";
import {
    buildCollectionViewModel,
    buildItemSummaryViewModel,
    buildUserViewModel,
    resolveDominantTypeId,
    sortByUpdatedAtDesc,
    toItemTypeViewModel,
} from "./view-models";
import type { ItemTypeRow } from "./view-models";

const itemTypes = itemTypeRecords.map(toItemTypeViewModel);
const itemTypesById = new Map(itemTypes.map((itemType) => [itemType.id, itemType]));

function typeId(name: ItemTypeName): string {
    const itemType = itemTypes.find((candidate) => candidate.name === name);
    if (!itemType) {
        throw new Error(`Missing item type: ${name}`);
    }
    return itemType.id;
}

const collection: MockCollectionRecord = {
    id: "collection",
    name: "Test collection",
    description: "Test",
    isFavorite: false,
    defaultTypeId: typeId("note"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
};

function makeItem(
    id: string,
    itemTypeId: string,
    updatedAt: string,
    overrides: Partial<MockItemRecord> = {},
): MockItemRecord {
    return {
        id,
        title: id,
        description: null,
        itemTypeId,
        contentType: "TEXT",
        content: null,
        url: null,
        fileUrl: null,
        fileName: null,
        fileSize: null,
        language: null,
        tags: [],
        isFavorite: false,
        isPinned: false,
        collectionIds: [collection.id],
        updatedAt: new Date(`${updatedAt}T00:00:00Z`),
        ...overrides,
    };
}

describe("item type view models", () => {
    it("joins persisted identity with configured presentation", () => {
        const snippet = itemTypes.find((itemType) => itemType.name === "snippet");

        expect(snippet).toMatchObject({
            id: typeId("snippet"),
            name: "snippet",
            label: ITEM_TYPE_CATALOG.snippet.label,
            slug: ITEM_TYPE_CATALOG.snippet.slug,
            contentType: "TEXT",
            isPro: false,
        });
    });

    it("rejects a persisted icon the application cannot render", () => {
        const row: ItemTypeRow = {
            id: "type",
            name: "snippet",
            icon: "NotARealIcon",
            color: "#000000",
        };

        expect(() => toItemTypeViewModel(row)).toThrow(/NotARealIcon/);
    });

    it("rejects a persisted name that is not in the catalog", () => {
        const row: ItemTypeRow = {
            id: "type",
            name: "diagram",
            icon: "Code",
            color: "#000000",
        };

        expect(() => toItemTypeViewModel(row)).toThrow(/diagram/);
    });
});

describe("collection view models", () => {
    it("uses the most recently updated item to break dominant-type ties", () => {
        const items = [
            makeItem("snippet-old", typeId("snippet"), "2026-01-01"),
            makeItem("snippet-new", typeId("snippet"), "2026-01-03"),
            makeItem("prompt-old", typeId("prompt"), "2026-01-02"),
            makeItem("prompt-new", typeId("prompt"), "2026-01-04"),
        ];

        expect(resolveDominantTypeId(collection, items)).toBe(typeId("prompt"));
    });

    it("uses the collection default type when the collection is empty", () => {
        expect(resolveDominantTypeId(collection, [])).toBe(typeId("note"));
    });

    it("has no dominant type when the collection is empty and has no default type", () => {
        const viewModel = buildCollectionViewModel(
            { ...collection, defaultTypeId: null },
            [],
            itemTypesById,
        );

        expect(viewModel.dominantItemType).toBeNull();
        expect(viewModel.itemTypes).toEqual([]);
    });

    it("derives collection counts and contained types", () => {
        const viewModel = buildCollectionViewModel(
            collection,
            [
                makeItem("snippet", typeId("snippet"), "2026-01-01"),
                makeItem("prompt", typeId("prompt"), "2026-01-02"),
            ],
            itemTypesById,
        );

        expect(viewModel.itemCount).toBe(2);
        expect(viewModel.itemTypes.map((itemType) => itemType.name)).toEqual(["snippet", "prompt"]);
    });

    it("normalizes nullable columns into display-safe values", () => {
        const viewModel = buildCollectionViewModel(
            { ...collection, description: null },
            [],
            itemTypesById,
        );

        expect(viewModel.description).toBe("");
        expect(
            buildItemSummaryViewModel(
                makeItem("item", typeId("snippet"), "2026-01-01"),
                itemTypesById,
            ).description,
        ).toBe("");
        expect(
            buildUserViewModel({
                id: "user",
                name: null,
                email: "john@example.com",
                image: null,
                isPro: false,
            }).name,
        ).toBe("john@example.com");
    });

    it("serializes timestamps as ISO strings", () => {
        const summary = buildItemSummaryViewModel(
            makeItem("item", typeId("snippet"), "2026-01-01"),
            itemTypesById,
        );

        expect(summary.updatedAt).toBe("2026-01-01T00:00:00.000Z");
    });

    it("sorts records by updatedAt without mutating the input", () => {
        const records = [
            { id: "older", updatedAt: new Date("2026-01-01T00:00:00Z") },
            { id: "newer", updatedAt: new Date("2026-01-02T00:00:00Z") },
        ];

        expect(sortByUpdatedAtDesc(records).map((record) => record.id)).toEqual(["newer", "older"]);
        expect(records[0].id).toBe("older");
    });

    it("sorts serialized view models the same way as records", () => {
        const viewModels = [
            { id: "older", updatedAt: "2026-01-01T00:00:00.000Z" },
            { id: "newer", updatedAt: "2026-01-02T00:00:00.000Z" },
        ];

        expect(sortByUpdatedAtDesc(viewModels).map((record) => record.id)).toEqual([
            "newer",
            "older",
        ]);
    });

    it("builds item summaries without list-inaccessible content", () => {
        const summary = buildItemSummaryViewModel(
            makeItem("item", typeId("snippet"), "2026-01-01", { content: "private body" }),
            itemTypesById,
        );

        expect(summary).not.toHaveProperty("content");
    });
});

describe("mock records", () => {
    it("keeps every mock item-type reference resolvable", () => {
        const referencedIds = [
            ...itemRecords.map((item) => item.itemTypeId),
            ...collectionRecords.map((record) => record.defaultTypeId).filter((id) => id !== null),
        ];

        expect(referencedIds.every((id) => itemTypesById.has(id))).toBe(true);
    });

    it("populates exactly the content column its contentType declares", () => {
        for (const item of itemRecords) {
            if (item.contentType === "TEXT") {
                expect(item.content, item.title).not.toBeNull();
                expect(item.url, item.title).toBeNull();
                expect(item.fileUrl, item.title).toBeNull();
            } else if (item.contentType === "URL") {
                expect(item.url, item.title).not.toBeNull();
                expect(item.content, item.title).toBeNull();
                expect(item.fileUrl, item.title).toBeNull();
            } else {
                expect(item.fileUrl, item.title).not.toBeNull();
                expect(item.fileName, item.title).not.toBeNull();
                expect(item.content, item.title).toBeNull();
                expect(item.url, item.title).toBeNull();
            }
        }
    });
});
