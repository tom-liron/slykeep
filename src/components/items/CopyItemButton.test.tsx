import { describe, expect, it } from "vitest";

import { TEXT_PREVIEW_MAX_BYTES } from "@/lib/file-preview";
import type { ContentType } from "@/types/item-type";
import type { ItemSummaryViewModel } from "@/types/view-models";
import { copyableSourceFor } from "./CopyItemButton";

/**
 * The copy icon offers itself before anything about the item has been fetched, so this rule decides
 * from the summary alone — and it is the only place a card can promise something it cannot deliver.
 * A picture with a copy button on it is the failure being guarded against.
 */

function itemWith(
    contentType: ContentType,
    file: { fileName: string; fileSize: number } = { fileName: "", fileSize: 0 },
): ItemSummaryViewModel {
    return {
        id: "item-1",
        title: "Stashed",
        description: "",
        tags: [],
        isFavorite: false,
        isPinned: false,
        editedAt: "2026-08-06T00:00:00.000Z",
        createdAt: "2026-08-06T00:00:00.000Z",
        ...file,
        itemType: {
            id: "type-1",
            name: "snippet",
            label: "Snippets",
            icon: "Code",
            color: "#FF5C5C",
            slug: "snippets",
            contentType,
            isPro: false,
        },
    };
}

describe("copyableSourceFor", () => {
    it("reads a TEXT or URL item from the item route", () => {
        expect(copyableSourceFor(itemWith("TEXT"))).toEqual({
            url: "/api/items/item-1",
            kind: "detail",
        });
        expect(copyableSourceFor(itemWith("URL"))).toEqual({
            url: "/api/items/item-1",
            kind: "detail",
        });
    });

    it("reads a text file from the file route, where its contents actually live", () => {
        // Both halves of "text": the code viewer's formats and the markdown one's.
        expect(
            copyableSourceFor(itemWith("FILE", { fileName: "compose.yml", fileSize: 400 })),
        ).toEqual({ url: "/api/files/item-1", kind: "file" });
        expect(
            copyableSourceFor(itemWith("FILE", { fileName: "notes.md", fileSize: 400 })),
        ).toEqual({ url: "/api/files/item-1", kind: "file" });
    });

    it("offers nothing for a file that is not text", () => {
        expect(
            copyableSourceFor(itemWith("FILE", { fileName: "shot.png", fileSize: 400 })),
        ).toBeNull();
        expect(
            copyableSourceFor(itemWith("FILE", { fileName: "spec.pdf", fileSize: 400 })),
        ).toBeNull();
        expect(
            copyableSourceFor(itemWith("FILE", { fileName: "mystery.bin", fileSize: 400 })),
        ).toBeNull();
    });

    it("offers nothing for a text file too large to have been rendered", () => {
        // Tracks the preview cap rather than restating a number: a file the drawer refuses to load
        // is one this button would sit and fetch megabytes for.
        expect(
            copyableSourceFor(
                itemWith("FILE", { fileName: "huge.json", fileSize: TEXT_PREVIEW_MAX_BYTES + 1 }),
            ),
        ).toBeNull();
    });

    it("offers nothing for a file item with no object", () => {
        expect(copyableSourceFor(itemWith("FILE"))).toBeNull();
    });
});
