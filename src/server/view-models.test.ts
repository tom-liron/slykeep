import { describe, expect, it } from "vitest";

import { ITEM_TYPE_CATALOG, SYSTEM_ITEM_TYPE_NAMES } from "@/config/item-type-catalog";
import type { ItemTypeName } from "@/types/item-type";
import {
    buildCollectionViewModel,
    buildItemDetailViewModel,
    buildItemSummaryViewModel,
    buildUserViewModel,
    resolveDominantTypeId,
    sortByUpdatedAtDesc,
    toItemTypeViewModel,
} from "./view-models";
import type { CollectionRow, ItemDetailRow, ItemSummaryRow, ItemTypeRow } from "./view-models";

// Self-contained fixtures: the item types the seed writes, joined to their configured presentation
// under synthetic ids. Nothing here reads the database — these exercise the pure derivation rules.
const itemTypes = SYSTEM_ITEM_TYPE_NAMES.map((name) =>
    toItemTypeViewModel({
        id: `type-${name}`,
        name,
        icon: ITEM_TYPE_CATALOG[name].icon,
        color: ITEM_TYPE_CATALOG[name].color,
    }),
);
const itemTypesById = new Map(itemTypes.map((itemType) => [itemType.id, itemType]));

function typeId(name: ItemTypeName): string {
    const itemType = itemTypes.find((candidate) => candidate.name === name);
    if (!itemType) {
        throw new Error(`Missing item type: ${name}`);
    }
    return itemType.id;
}

const collection: CollectionRow = {
    id: "collection",
    name: "Test collection",
    description: "Test",
    isFavorite: false,
    defaultTypeId: typeId("note"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
};

function makeItem(id: string, itemTypeId: string, updatedAt: string): ItemSummaryRow {
    return {
        id,
        title: id,
        description: null,
        itemTypeId,
        tags: [],
        isFavorite: false,
        isPinned: false,
        updatedAt: new Date(`${updatedAt}T00:00:00Z`),
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

describe("item detail view models", () => {
    function makeDetail(overrides: Partial<ItemDetailRow> = {}): ItemDetailRow {
        return {
            ...makeItem("item", typeId("snippet"), "2026-01-02"),
            content: null,
            url: null,
            language: null,
            collections: [],
            createdAt: new Date("2026-01-01T00:00:00Z"),
            ...overrides,
        };
    }

    it("normalizes every absent body field to an empty string", () => {
        const viewModel = buildItemDetailViewModel(makeDetail(), itemTypesById);

        // A drawer renders these directly, so null must not reach it — one of them is always empty,
        // since the content type decides which single field holds the body.
        expect(viewModel.content).toBe("");
        expect(viewModel.url).toBe("");
        expect(viewModel.language).toBe("");
    });

    it("carries the summary's own normalization, so both timestamps are ISO strings", () => {
        const viewModel = buildItemDetailViewModel(
            makeDetail({ description: null, content: "const x = 1;" }),
            itemTypesById,
        );

        expect(viewModel.description).toBe("");
        expect(viewModel.content).toBe("const x = 1;");
        expect(viewModel.createdAt).toBe("2026-01-01T00:00:00.000Z");
        expect(viewModel.updatedAt).toBe("2026-01-02T00:00:00.000Z");
        expect(viewModel.itemType.name).toBe("snippet");
    });

    it("copies the collection names rather than aliasing the row's array", () => {
        const collections = ["React Patterns"];
        const viewModel = buildItemDetailViewModel(makeDetail({ collections }), itemTypesById);

        collections.push("Interview Prep");

        expect(viewModel.collections).toEqual(["React Patterns"]);
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
        // A row carrying a content body must not leak it into the summary: the builder constructs
        // its output explicitly rather than spreading the input.
        const rowWithContent = {
            ...makeItem("item", typeId("snippet"), "2026-01-01"),
            content: "private body",
        };

        const summary = buildItemSummaryViewModel(rowWithContent, itemTypesById);

        expect(summary).not.toHaveProperty("content");
    });
});
