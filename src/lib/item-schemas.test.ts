import { describe, expect, it } from "vitest";

import { SYSTEM_ITEM_TYPE_NAMES } from "@/config/item-type-catalog";
import { MAX_UPLOAD_BYTES } from "./file-constraints";
import {
    CREATABLE_ITEM_TYPE_NAMES,
    createItemSchema,
    normalizeTagName,
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

        /**
         * `z.url()` on its own accepts every one of these — it checks shape, and the WHATWG parser
         * behind it is happy with any scheme. `ItemDrawer` renders the stored value as `href`, so a
         * saved `javascript:` URL runs on this origin when the link is clicked. These pin the
         * `protocol` bound so a Zod upgrade or a rewrite of `optionalUrl` cannot drop it quietly.
         */
        it.each([
            "javascript:alert(document.cookie)",
            "JaVaScRiPt:alert(1)",
            "data:text/html,<script>alert(1)</script>",
            "vbscript:msgbox(1)",
            "file:///etc/passwd",
        ])("refuses %s", (url) => {
            expect(firstError({ ...base, url })).toBe("Enter a valid URL.");
        });

        it("still accepts both schemes a link may use, in any case", () => {
            expect(parse({ ...base, url: "http://example.com" }).url).toBe("http://example.com");
            expect(parse({ ...base, url: "HTTPS://Example.com" }).url).toBe("HTTPS://Example.com");
        });
    });

    describe("normalizeTagName", () => {
        it("folds case and trims, which is what the unique constraint is on", () => {
            expect(normalizeTagName("  React  ")).toBe("react");
            expect(normalizeTagName("PostgreSQL")).toBe("postgresql");
        });

        it("collapses only case, never spelling", () => {
            // The line this project draws: `react` and `React` are one tag, `react` and `reactjs`
            // are two. Nothing can mechanically know the second pair mean the same thing, and
            // guessing is worse than not trying — that is what tag autocomplete is for.
            expect(normalizeTagName("reactjs")).not.toBe(normalizeTagName("react"));
            expect(normalizeTagName("react-js")).not.toBe(normalizeTagName("react"));
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

    describe("collectionIds", () => {
        it("drops a repeated id", () => {
            // `ItemCollection`'s primary key is [itemId, collectionId], so the same id twice is a
            // unique-constraint violation the user would see as "could not save your changes".
            expect(parse({ ...base, collectionIds: ["c1", "c2", "c1"] }).collectionIds).toEqual([
                "c1",
                "c2",
            ]);
        });

        it("treats an empty array as 'in no collection' rather than 'leave them alone'", () => {
            // The edit form's every-box-unchecked save. It has to reach the action as an empty list
            // and not as an absent key, or an item could never be removed from its last collection.
            expect(parse({ ...base, collectionIds: [] }).collectionIds).toEqual([]);
        });

        it("leaves an omitted list undefined, so membership is untouched", () => {
            expect(parse(base).collectionIds).toBeUndefined();
        });

        it("rejects more collections than one payload may carry", () => {
            const collectionIds = Array.from({ length: 101 }, (_, index) => `c-${index}`);

            expect(firstError({ ...base, collectionIds })).toBe("That is too many collections.");
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
        it("offers every system type, file and image included", () => {
            // The FILE types were held back only until there was something to upload with. Derived
            // from the catalog so a type added there is not quietly left out of the dialog.
            expect([...CREATABLE_ITEM_TYPE_NAMES].sort()).toEqual(
                [...SYSTEM_ITEM_TYPE_NAMES].sort(),
            );
        });

        it("rejects a type that is not in the catalog", () => {
            // TypeScript stops the dialog from sending this; nothing stops a hand-made payload.
            const payload = { type: "webhook", title: "Sneaky" } as unknown as CreateItemInput;

            expect(errorFor(payload, "type")).toBe("Choose an item type.");
        });
    });

    describe("file columns", () => {
        /** What the dialog submits once `POST /api/upload` has answered. */
        const upload = {
            fileKey: "users/user_1/3f0c9c1e-0000-4000-8000-00000000abcd.png",
            fileName: "diagram.png",
            fileSize: 2048,
        };

        it("insists a file item has an upload", () => {
            // Whether the key is *this user's* is not decided here — only the server knows who that
            // is, so `createItem` re-checks it with `isOwnedKey`.
            expect(errorFor({ ...newItem, type: "image" }, "fileKey")).toBe("Upload a file first.");
        });

        it("refuses a size no upload could have produced", () => {
            // The one round-tripped upload field the write boundary never re-derived. It is what
            // `filePreviewFor` tests against `TEXT_PREVIEW_MAX_BYTES`, so an unbounded claim decides
            // whether the drawer fetches a whole object and hands it to monaco.
            const payload = {
                ...newItem,
                type: "file",
                ...upload,
                fileSize: MAX_UPLOAD_BYTES + 1,
            } as CreateItemInput;

            expect(errorFor(payload, "fileSize")).toBeDefined();
        });

        it("accepts a size at the ceiling", () => {
            const data = parseNew({
                ...newItem,
                type: "file",
                ...upload,
                fileSize: MAX_UPLOAD_BYTES,
            });

            expect(data.fileSize).toBe(MAX_UPLOAD_BYTES);
        });

        it("keeps all three file columns together for a file item", () => {
            const data = parseNew({ ...newItem, type: "file", ...upload });

            expect(data.fileKey).toBe(upload.fileKey);
            expect(data.fileName).toBe(upload.fileName);
            expect(data.fileSize).toBe(upload.fileSize);
        });

        it("drops a file from a type that has nowhere to put it", () => {
            // The mirror of dropping a URL from a snippet: `contentType` is TEXT, so a `fileKey`
            // column would contradict the field that says where this item's content lives.
            const data = parseNew({ ...newItem, ...upload });

            expect(data.fileKey).toBeUndefined();
            expect(data.fileName).toBeUndefined();
            expect(data.fileSize).toBeUndefined();
        });

        it("drops the content and URL columns from a file item", () => {
            const data = parseNew({
                ...newItem,
                type: "image",
                ...upload,
                content: "not a file",
                url: "https://example.com",
            });

            expect(data.content).toBeUndefined();
            expect(data.url).toBeUndefined();
        });

        it("rejects a size that is not a positive whole number of bytes", () => {
            // Zod's own wording, so this asserts only that it was rejected and against which field.
            expect(
                errorFor({ ...newItem, type: "file", ...upload, fileSize: 0 }, "fileSize"),
            ).toBeDefined();
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

        it("refuses a scheme a link may not use", () => {
            // The same `optionalUrl` the edit path uses, asserted here too because this is the path
            // that puts a URL in the column in the first place.
            expect(errorFor({ ...newItem, type: "link", url: "javascript:alert(1)" }, "url")).toBe(
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
