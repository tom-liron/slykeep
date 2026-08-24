import { describe, expect, it } from "vitest";

import {
    AI_TAG_CONTENT_LIMIT,
    MAX_SUGGESTED_TAGS,
    addTagToInput,
    buildTagInput,
    parseSuggestedTags,
    truncateForTagging,
} from "./ai-tags";

/**
 * Both halves of the model call that can be wrong without failing to compile.
 *
 * `parseSuggestedTags` reads a string a third party wrote, so every case here is one the model has
 * actually been observed to produce or could produce tomorrow — the two container shapes, a count
 * outside the range the prompt asked for, casing that varies within one response. None of it is
 * reachable from a type.
 *
 * `truncateForTagging` is here for the surrogate pair: the obvious `slice` passes every test that
 * uses ASCII and corrupts the one character that matters.
 */

describe("parseSuggestedTags", () => {
    it("reads the wrapped shape the prompt asks for", () => {
        expect(parseSuggestedTags('{"tags": ["react", "hooks"]}')).toEqual(["react", "hooks"]);
    });

    it("reads the bare array the model sometimes returns instead", () => {
        expect(parseSuggestedTags('["react", "hooks"]')).toEqual(["react", "hooks"]);
    });

    it("lowercases, so a suggestion matches a tag the user already has", () => {
        expect(parseSuggestedTags('{"tags": ["React", "TypeScript"]}')).toEqual([
            "react",
            "typescript",
        ]);
    });

    it("collapses duplicates that differ only in case or whitespace", () => {
        expect(parseSuggestedTags('{"tags": ["react", "React", "  react  "]}')).toEqual(["react"]);
    });

    it("drops blanks and non-string entries rather than failing on them", () => {
        expect(parseSuggestedTags('{"tags": ["react", "", "   ", null, 7, ["nested"]]}')).toEqual([
            "react",
        ]);
    });

    it("drops a tag longer than the schema would accept, rather than truncating it", () => {
        const tooLong = "a".repeat(51);

        expect(parseSuggestedTags(`{"tags": ["react", "${tooLong}"]}`)).toEqual(["react"]);
    });

    it("keeps at most five, however many come back", () => {
        const many = ["one", "two", "three", "four", "five", "six", "seven"];

        expect(parseSuggestedTags(JSON.stringify({ tags: many }))).toHaveLength(MAX_SUGGESTED_TAGS);
    });

    it("returns nothing for malformed JSON, an unrelated shape, or an empty list", () => {
        expect(parseSuggestedTags("not json at all")).toEqual([]);
        expect(parseSuggestedTags("")).toEqual([]);
        expect(parseSuggestedTags('{"suggestions": ["react"]}')).toEqual([]);
        expect(parseSuggestedTags('{"tags": []}')).toEqual([]);
        expect(parseSuggestedTags("null")).toEqual([]);
    });
});

describe("truncateForTagging", () => {
    it("leaves content under the cap exactly as it was", () => {
        const content = "const a = 1;";

        expect(truncateForTagging(content)).toBe(content);
    });

    it("cuts content over the cap down to it", () => {
        expect(truncateForTagging("a".repeat(AI_TAG_CONTENT_LIMIT + 500))).toHaveLength(
            AI_TAG_CONTENT_LIMIT,
        );
    });

    it("cuts on a character boundary, not half way through a surrogate pair", () => {
        // Each emoji is two UTF-16 code units, so the cap lands mid-character — the case a plain
        // `slice` turns into a replacement glyph.
        const cut = truncateForTagging("😀".repeat(AI_TAG_CONTENT_LIMIT));

        expect(cut).not.toContain("�");
        expect(cut.endsWith("😀")).toBe(true);
        expect([...cut]).toHaveLength(AI_TAG_CONTENT_LIMIT);
    });
});

describe("buildTagInput", () => {
    it("labels the title and the body so one is not read as the other", () => {
        const input = buildTagInput({
            title: "Debounce hook",
            content: "const x = 1;",
            type: "snippet",
        });

        expect(input).toContain("Item type: snippet");
        expect(input).toContain("Title: Debounce hook");
        expect(input).toContain("Content:\nconst x = 1;");
    });

    it("always names JSON, which the API requires of the input itself", () => {
        // Not decoration: `text.format: { type: "json_object" }` is a 400 without it, and the same
        // word in `instructions` does not count. Every call, including the sparsest one.
        expect(buildTagInput({ title: "t", content: "" }).toLowerCase()).toContain("json");
        expect(buildTagInput({ title: "", content: "c" }).toLowerCase()).toContain("json");
    });

    it("omits the half that is missing instead of labelling an empty one", () => {
        expect(buildTagInput({ title: "Just a name", content: "" })).not.toContain("Content:");
        expect(buildTagInput({ title: "", content: "body" })).not.toContain("Title:");
    });

    it("truncates the body it sends", () => {
        const input = buildTagInput({
            title: "t",
            content: "a".repeat(AI_TAG_CONTENT_LIMIT + 100),
        });

        expect(input).toContain("a".repeat(AI_TAG_CONTENT_LIMIT));
        expect(input).not.toContain("a".repeat(AI_TAG_CONTENT_LIMIT + 1));
    });
});

describe("addTagToInput", () => {
    it("appends to what is already there", () => {
        expect(addTagToInput("react", "hooks")).toBe("react, hooks");
    });

    it("is the whole value when the field is empty or blank", () => {
        expect(addTagToInput("", "react")).toBe("react");
        expect(addTagToInput("   ", "react")).toBe("react");
    });

    it("does not double a tag the user already typed, whatever its case", () => {
        expect(addTagToInput("React, hooks", "react")).toBe("React, hooks");
        expect(addTagToInput("react", "React")).toBe("react");
    });

    it("replaces a trailing separator instead of appending after it", () => {
        expect(addTagToInput("react,", "hooks")).toBe("react, hooks");
        expect(addTagToInput("react, ", "hooks")).toBe("react, hooks");
    });
});
