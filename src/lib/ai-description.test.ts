import { describe, expect, it } from "vitest";

import {
    AI_DESCRIPTION_CONTENT_LIMIT,
    MAX_DESCRIPTION_LENGTH,
    buildDescriptionInput,
    hasDescribableContent,
    parseSuggestedDescription,
} from "./ai-description";

/**
 * Both halves of the model call that can be wrong without failing to compile.
 *
 * `parseSuggestedDescription` reads a string a third party wrote, so every case here is one the
 * model can produce: the two container shapes, prose with no wrapper at all, a broken object, an
 * answer far longer than the instruction asked for. None of it is reachable from a type.
 *
 * `buildDescriptionInput` is here for the requirement that made this feature different from
 * tagging — *whatever information the type has* — which is a claim about a builder with six
 * optional fields and no branch per type. The `json` assertion in it is not style: without that
 * word in the input, every call is a 400.
 */

describe("parseSuggestedDescription", () => {
    it("reads the wrapped shape the prompt asks for", () => {
        expect(
            parseSuggestedDescription('{"description": "A React hook that debounces a value."}'),
        ).toBe("A React hook that debounces a value.");
    });

    it("reads the bare string the model sometimes returns instead", () => {
        expect(parseSuggestedDescription('"A React hook that debounces a value."')).toBe(
            "A React hook that debounces a value.",
        );
    });

    it("accepts prose that was never wrapped in JSON at all", () => {
        expect(parseSuggestedDescription("A React hook that debounces a value.")).toBe(
            "A React hook that debounces a value.",
        );
    });

    it("collapses the newlines the two-row field cannot show", () => {
        expect(
            parseSuggestedDescription('{"description": "One sentence.\\n\\nAnother one."}'),
        ).toBe("One sentence. Another one.");
    });

    it("trims the surrounding whitespace", () => {
        expect(parseSuggestedDescription('{"description": "  Padded.  "}')).toBe("Padded.");
    });

    it("rejects an answer longer than the field is meant to hold", () => {
        const essay = `{"description": "${"word ".repeat(MAX_DESCRIPTION_LENGTH)}"}`;

        expect(parseSuggestedDescription(essay)).toBeNull();
    });

    it("keeps an answer that is exactly at the cap", () => {
        const exact = "a".repeat(MAX_DESCRIPTION_LENGTH);

        expect(parseSuggestedDescription(`{"description": "${exact}"}`)).toBe(exact);
    });

    it("rejects a broken object rather than handing back its syntax", () => {
        // A truncated response is the way this arrives. Returning the raw text would put a stray
        // `{"description": "` into the user's field.
        expect(parseSuggestedDescription('{"description": "half a sen')).toBeNull();
    });

    it("rejects what it cannot use", () => {
        expect(parseSuggestedDescription("")).toBeNull();
        expect(parseSuggestedDescription("   ")).toBeNull();
        expect(parseSuggestedDescription('{"summary": "wrong key"}')).toBeNull();
        expect(parseSuggestedDescription('{"description": null}')).toBeNull();
        expect(parseSuggestedDescription('{"description": ""}')).toBeNull();
        expect(parseSuggestedDescription("null")).toBeNull();
        expect(parseSuggestedDescription('["a list"]')).toBeNull();
    });
});

describe("buildDescriptionInput", () => {
    it("labels every part so one is not read as another", () => {
        const input = buildDescriptionInput({
            title: "Debounce hook",
            content: "const x = 1;",
            language: "typescript",
            tags: "react, hooks",
            type: "snippet",
        });

        expect(input).toContain("Item type: snippet");
        expect(input).toContain("Title: Debounce hook");
        expect(input).toContain("Language: typescript");
        expect(input).toContain("Tags: react, hooks");
        expect(input).toContain("Content:\nconst x = 1;");
    });

    it("describes a link from its URL, which is all a link has", () => {
        const input = buildDescriptionInput({ title: "Docs", url: "https://x.dev", type: "link" });

        expect(input).toContain("URL: https://x.dev");
        expect(input).not.toContain("Content:");
    });

    it("describes a file from its name, which is all a file has", () => {
        const input = buildDescriptionInput({ fileName: "deploy-notes.pdf", type: "file" });

        expect(input).toContain("File name: deploy-notes.pdf");
        expect(input).not.toContain("Title:");
    });

    it("omits every field the draft does not have, rather than labelling an empty one", () => {
        const input = buildDescriptionInput({ content: "just a body" });

        expect(input).toContain("Item type: item");
        expect(input).not.toContain("Title:");
        expect(input).not.toContain("URL:");
        expect(input).not.toContain("File name:");
        expect(input).not.toContain("Language:");
        expect(input).not.toContain("Tags:");
    });

    it("always contains the word the API requires for json_object output", () => {
        // Without it every request is a 400, whatever else the prompt says.
        expect(buildDescriptionInput({ title: "x" }).toLowerCase()).toContain("json");
        expect(buildDescriptionInput({}).toLowerCase()).toContain("json");
    });

    it("truncates a long body rather than paying to send all of it", () => {
        const input = buildDescriptionInput({
            content: "a".repeat(AI_DESCRIPTION_CONTENT_LIMIT + 500),
        });

        expect(input).toContain("a".repeat(AI_DESCRIPTION_CONTENT_LIMIT));
        expect(input).not.toContain("a".repeat(AI_DESCRIPTION_CONTENT_LIMIT + 1));
    });
});

describe("hasDescribableContent", () => {
    it("accepts an item with any one of the four things worth describing", () => {
        expect(hasDescribableContent({ title: "Just a title" })).toBe(true);
        expect(hasDescribableContent({ content: "just a body" })).toBe(true);
        expect(hasDescribableContent({ url: "https://x.dev" })).toBe(true);
        expect(hasDescribableContent({ fileName: "notes.pdf" })).toBe(true);
    });

    it("refuses a draft that is empty or only whitespace", () => {
        expect(hasDescribableContent({})).toBe(false);
        expect(hasDescribableContent({ title: "   ", content: "\n\n" })).toBe(false);
    });

    it("refuses a draft carrying only what cannot be described on its own", () => {
        // A language and a set of tags describe nothing by themselves — there is no item there yet.
        expect(
            hasDescribableContent({ language: "typescript", tags: "react", type: "snippet" }),
        ).toBe(false);
    });
});
