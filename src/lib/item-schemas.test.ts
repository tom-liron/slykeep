import { describe, expect, it } from "vitest";

import { ITEM_TYPE_CATALOG, SYSTEM_ITEM_TYPE_NAMES } from "@/config/item-type-catalog";
import {
    CREATABLE_ITEM_TYPE_NAMES,
    createItemSchema,
    updateItemSchema,
    type CreateItemInput,
    type UpdateItemInput,
} from "./item-schemas";

/** The minimum a valid payload needs, so each case can vary one field at a time. */
const base: UpdateItemInput = { title: "A snippet" };

function parse(input: UpdateItemInput) {
    const result = updateItemSchema.safeParse(input);
    if (!result.success) {
        throw new Error(`Expected the payload to parse: ${result.error.issues[0]?.message}`);
    }

    return result.data;
}

function firstError(input: UpdateItemInput): string | undefined {
    const result = updateItemSchema.safeParse(input);

    return result.success ? undefined : result.error.issues[0]?.message;
}

describe("updateItemSchema", () => {
    describe("title", () => {
        it("trims before checking that it is present", () => {
            expect(parse({ ...base, title: "  Padded  " }).title).toBe("Padded");
        });

        it("rejects a title that is only whitespace", () => {
            // The check has to run *after* the trim, or "   " passes min(1) as three characters.
            expect(firstError({ ...base, title: "   " })).toBe("Title is required.");
        });

        it("rejects a title past the length cap", () => {
            expect(firstError({ ...base, title: "x".repeat(201) })).toMatch(/at most 200/);
        });
    });

    describe("optional text columns", () => {
        it("leaves an omitted field undefined, so the column is not written", () => {
            // The contract the drawer depends on: a snippet's payload has no `url` key, and that has
            // to reach Prisma as `undefined` ("do nothing") rather than null ("clear it").
            const data = parse(base);

            expect(data.description).toBeUndefined();
            expect(data.content).toBeUndefined();
            expect(data.url).toBeUndefined();
            expect(data.language).toBeUndefined();
        });

        it("turns a blank or whitespace value into null, so nothing is stored as an empty string", () => {
            expect(parse({ ...base, description: "" }).description).toBeNull();
            expect(parse({ ...base, content: "   " }).content).toBeNull();
        });

        it("keeps a trimmed value", () => {
            expect(parse({ ...base, description: "  A note  " }).description).toBe("A note");
        });

        it("accepts an explicit null", () => {
            expect(parse({ ...base, content: null }).content).toBeNull();
        });
    });

    describe("url", () => {
        it("accepts a well-formed URL", () => {
            expect(parse({ ...base, url: "https://example.com/docs" }).url).toBe(
                "https://example.com/docs",
            );
        });

        it("rejects something that is not a URL", () => {
            expect(firstError({ ...base, url: "not a url" })).toBe("Enter a valid URL.");
        });

        it("clears rather than rejects when the field is emptied", () => {
            expect(parse({ ...base, url: "" }).url).toBeNull();
        });
    });

    describe("tags", () => {
        it("trims each tag and drops the blanks a comma-split leaves behind", () => {
            // "react, , hooks" is ordinary typing, not a malformed payload.
            expect(parse({ ...base, tags: ["react", " ", " hooks "] }).tags).toEqual([
                "react",
                "hooks",
            ]);
        });

        it("de-duplicates case-insensitively, keeping the first spelling", () => {
            // Tag.name is globally unique, so two casings would be two rows — and connecting the
            // same tag twice in one `set` is not a thing the relation can express.
            expect(parse({ ...base, tags: ["React", "react", "REACT"] }).tags).toEqual(["React"]);
        });

        it("treats an empty array as 'remove every tag' rather than 'leave them alone'", () => {
            expect(parse({ ...base, tags: [] }).tags).toEqual([]);
        });

        it("leaves an omitted tag list undefined", () => {
            expect(parse(base).tags).toBeUndefined();
        });

        it("collapses an emptied input to no tags", () => {
            // What `"".split(",")` hands over.
            expect(parse({ ...base, tags: [""] }).tags).toEqual([]);
        });

        it("rejects more tags than an item may carry", () => {
            const tags = Array.from({ length: 21 }, (_, index) => `tag-${index}`);

            expect(firstError({ ...base, tags })).toMatch(/at most 20 tags/);
        });

        it("rejects a tag past the length cap", () => {
            expect(firstError({ ...base, tags: ["x".repeat(51)] })).toMatch(
                /at most 50 characters/,
            );
        });
    });
});

/** A snippet is the dialog's default, so it is what the create cases vary from. */
const newItem: CreateItemInput = { type: "snippet", title: "A snippet" };

function parseNew(input: CreateItemInput) {
    const result = createItemSchema.safeParse(input);
    if (!result.success) {
        throw new Error(`Expected the payload to parse: ${result.error.issues[0]?.message}`);
    }

    return result.data;
}

/** The message reported against one field, which is how the dialog places it under an input. */
function errorFor(input: CreateItemInput, field: string): string | undefined {
    const result = createItemSchema.safeParse(input);

    return result.success
        ? undefined
        : result.error.issues.find((issue) => issue.path[0] === field)?.message;
}

describe("createItemSchema", () => {
    describe("type", () => {
        it("offers exactly the catalog types that do not store a file", () => {
            // The dialog cannot upload anything until Phase 4, so a FILE type could only produce an
            // item with no file. Derived from the catalog here so adding a type there fails this
            // rather than quietly leaving it out of the dialog.
            const expected = SYSTEM_ITEM_TYPE_NAMES.filter(
                (name) => ITEM_TYPE_CATALOG[name].contentType !== "FILE",
            );

            expect([...CREATABLE_ITEM_TYPE_NAMES].sort()).toEqual([...expected].sort());
        });

        it("rejects a type the dialog does not offer", () => {
            // TypeScript stops the dialog from sending this; nothing stops a hand-made payload.
            const payload = { type: "image", title: "Sneaky" } as unknown as CreateItemInput;

            expect(errorFor(payload, "type")).toBe("Choose an item type.");
        });
    });

    describe("columns the chosen type does not own", () => {
        it("drops content and language from a link", () => {
            const data = parseNew({
                ...newItem,
                type: "link",
                url: "https://example.com",
                content: "console.log('nope')",
                language: "typescript",
            });

            // Not merely ignored by the form: `contentType` is URL, so writing either column would
            // contradict the field that says which one holds this item's content.
            expect(data.content).toBeUndefined();
            expect(data.language).toBeUndefined();
            expect(data.url).toBe("https://example.com");
        });

        it("drops a URL from a text type", () => {
            expect(parseNew({ ...newItem, url: "https://example.com" }).url).toBeUndefined();
        });

        it("drops a language from a type whose content is not code", () => {
            expect(
                parseNew({ ...newItem, type: "note", language: "typescript" }).language,
            ).toBeUndefined();
        });

        it("keeps the language a snippet or command declares", () => {
            expect(parseNew({ ...newItem, language: "typescript" }).language).toBe("typescript");
            expect(parseNew({ ...newItem, type: "command", language: "bash" }).language).toBe(
                "bash",
            );
        });
    });

    describe("url", () => {
        it("insists a link has one", () => {
            expect(errorFor({ ...newItem, type: "link" }, "url")).toBe("URL is required.");
        });

        it("treats a blank URL as missing rather than as clearing it", () => {
            // An edit reads "" as "clear this column"; there is nothing to clear on a new row.
            expect(errorFor({ ...newItem, type: "link", url: "   " }, "url")).toBe(
                "URL is required.",
            );
        });

        it("still checks the shape of one that was given", () => {
            expect(errorFor({ ...newItem, type: "link", url: "not a url" }, "url")).toBe(
                "Enter a valid URL.",
            );
        });

        it("does not require one from a type that has nowhere to put it", () => {
            expect(errorFor(newItem, "url")).toBeUndefined();
        });
    });

    it("requires a title, as an edit does", () => {
        expect(errorFor({ ...newItem, title: "   " }, "title")).toBe("Title is required.");
    });

    it("normalizes tags the same way an edit does", () => {
        expect(parseNew({ ...newItem, tags: ["react", " ", "React"] }).tags).toEqual(["react"]);
    });

    it("leaves an omitted optional column undefined, so the row is written without it", () => {
        const data = parseNew(newItem);

        expect(data.description).toBeUndefined();
        expect(data.content).toBeUndefined();
        expect(data.tags).toBeUndefined();
    });
});
