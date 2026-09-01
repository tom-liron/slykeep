import { describe, expect, it } from "vitest";

import { ITEM_TYPE_CATALOG, SYSTEM_ITEM_TYPE_NAMES } from "@/config/item-type-catalog";
import type { ItemTypeName } from "@/types/item-type";
import {
    buildCollectionViewModel,
    buildItemDetailViewModel,
    buildItemSummaryViewModel,
    buildItemTypeBreakdown,
    buildUserViewModel,
    requireItemType,
    resolveDominantTypeId,
    sortByEditedAtDesc,
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

function makeItem(id: string, itemTypeId: string, editedAt: string): ItemSummaryRow {
    return {
        id,
        title: id,
        description: null,
        itemTypeId,
        tags: [],
        isFavorite: false,
        isPinned: false,
        editedAt: new Date(`${editedAt}T00:00:00Z`),
        createdAt: new Date("2026-01-01T00:00:00Z"),
        fileName: null,
        fileSize: null,
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
        expect(viewModel.editedAt).toBe("2026-01-02T00:00:00.000Z");
        expect(viewModel.itemType.name).toBe("snippet");
    });

    it("copies the collections rather than aliasing the row's array", () => {
        const collections = [{ id: "collection-1", name: "React Patterns" }];
        const viewModel = buildItemDetailViewModel(makeDetail({ collections }), itemTypesById);

        collections.push({ id: "collection-2", name: "Interview Prep" });

        expect(viewModel.collections).toEqual([{ id: "collection-1", name: "React Patterns" }]);
    });

    it("carries each collection's id, which is what the edit form preselects by", () => {
        const viewModel = buildItemDetailViewModel(
            makeDetail({ collections: [{ id: "collection-1", name: "React Patterns" }] }),
            itemTypesById,
        );

        expect(viewModel.collections).toEqual([{ id: "collection-1", name: "React Patterns" }]);
    });
});

describe("collection view models", () => {
    it("uses the most recently edited item to break dominant-type ties", () => {
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

    it("counts the collection's items per type, most numerous first", () => {
        const breakdown = buildItemTypeBreakdown(
            [
                makeItem("snippet-1", typeId("snippet"), "2026-01-01"),
                makeItem("command", typeId("command"), "2026-01-02"),
                makeItem("snippet-2", typeId("snippet"), "2026-01-03"),
                makeItem("prompt-1", typeId("prompt"), "2026-01-04"),
                makeItem("prompt-2", typeId("prompt"), "2026-01-05"),
                makeItem("prompt-3", typeId("prompt"), "2026-01-06"),
            ],
            itemTypesById,
        );

        expect(breakdown.map(({ label, itemCount }) => [label, itemCount])).toEqual([
            ["Prompts", 3],
            ["Snippets", 2],
            ["Commands", 1],
        ]);
    });

    it("breaks count ties by label, so the order does not depend on the item type map", () => {
        // The map is built from an unordered `findMany`; without the tiebreak these two could swap
        // places between requests.
        const breakdown = buildItemTypeBreakdown(
            [
                makeItem("prompt", typeId("prompt"), "2026-01-01"),
                makeItem("command", typeId("command"), "2026-01-02"),
            ],
            itemTypesById,
        );

        expect(breakdown.map((itemType) => itemType.label)).toEqual(["Commands", "Prompts"]);
    });

    it("omits types the collection has no items of, rather than listing them at zero", () => {
        const breakdown = buildItemTypeBreakdown(
            [makeItem("note", typeId("note"), "2026-01-01")],
            itemTypesById,
        );

        expect(breakdown).toHaveLength(1);
        expect(breakdown[0]).toMatchObject({ label: "Notes", itemCount: 1, slug: "notes" });
    });

    it("has an empty breakdown for an empty collection", () => {
        expect(buildItemTypeBreakdown([], itemTypesById)).toEqual([]);
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

        expect(summary.editedAt).toBe("2026-01-01T00:00:00.000Z");
        expect(summary.createdAt).toBe("2026-01-01T00:00:00.000Z");
    });

    it("normalizes the file pair for an item that has no object", () => {
        // Every non-FILE item takes this path, and the file row reads both fields unconditionally,
        // so null must never reach it.
        const summary = buildItemSummaryViewModel(
            makeItem("item", typeId("snippet"), "2026-01-01"),
            itemTypesById,
        );

        expect(summary.fileName).toBe("");
        expect(summary.fileSize).toBe(0);
    });

    it("carries a file item's name and size onto the summary", () => {
        const summary = buildItemSummaryViewModel(
            {
                ...makeItem("item", typeId("file"), "2026-01-01"),
                fileName: "docker-compose.yml",
                fileSize: 2048,
            },
            itemTypesById,
        );

        expect(summary.fileName).toBe("docker-compose.yml");
        expect(summary.fileSize).toBe(2048);
    });

    it("sorts records by editedAt without mutating the input", () => {
        const records = [
            { id: "older", editedAt: new Date("2026-01-01T00:00:00Z") },
            { id: "newer", editedAt: new Date("2026-01-02T00:00:00Z") },
        ];

        expect(sortByEditedAtDesc(records).map((record) => record.id)).toEqual(["newer", "older"]);
        expect(records[0].id).toBe("older");
    });

    it("sorts serialized view models the same way as records", () => {
        const viewModels = [
            { id: "older", editedAt: "2026-01-01T00:00:00.000Z" },
            { id: "newer", editedAt: "2026-01-02T00:00:00.000Z" },
        ];

        expect(sortByEditedAtDesc(viewModels).map((record) => record.id)).toEqual([
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

describe("requireItemType", () => {
    it("resolves an id the map holds", () => {
        expect(requireItemType(typeId("snippet"), itemTypesById).name).toBe("snippet");
    });

    it("throws on an id the map does not hold", () => {
        // The behaviour the dominant-type call sites now share. It used to be answered two ways —
        // this throw on the collection cards, `?? null` in the sidebar beside them — so one dangling
        // id was a 500 on one surface and a colourless dot on another, from the same data.
        expect(() => requireItemType("type-missing", itemTypesById)).toThrow(
            "Unknown item type: type-missing",
        );
    });
});
