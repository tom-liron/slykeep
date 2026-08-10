import { describe, expect, it } from "vitest";

import { fuzzyScore, rankBySearch, scoreRecord, type SearchField } from "./fuzzy-search";

/** A record shaped like what the palette ranks: one weighted title, one weighted body. */
function fields(title: string, body = ""): SearchField[] {
    return [
        { text: title, weight: 1, scattered: true },
        { text: body, weight: 0.7 },
    ];
}

describe("fuzzyScore", () => {
    it("ranks the match kinds in order: exact, prefix, word start, substring, scattered", () => {
        const exact = fuzzyScore("use", "use");
        const prefix = fuzzyScore("use", "useState hook");
        const wordStart = fuzzyScore("use", "react useState");
        const substring = fuzzyScore("use", "abuse of hooks");
        const scattered = fuzzyScore("ustate", "useState", true);

        expect(exact).toBeGreaterThan(prefix);
        expect(prefix).toBeGreaterThan(wordStart);
        expect(wordStart).toBeGreaterThan(substring);
        expect(substring).toBeGreaterThan(scattered);
        expect(scattered).toBeGreaterThan(0);
    });

    it("scores zero when the characters do not appear in order", () => {
        expect(fuzzyScore("zebra", "useState hook", true)).toBe(0);
        expect(fuzzyScore("esu", "use", true)).toBe(0);
    });

    it("scores zero for an empty query or an empty text", () => {
        expect(fuzzyScore("", "useState")).toBe(0);
        expect(fuzzyScore("   ", "useState")).toBe(0);
        expect(fuzzyScore("use", "")).toBe(0);
    });

    it("ignores case and surrounding whitespace on both sides", () => {
        expect(fuzzyScore("USE", "  use  ")).toBe(fuzzyScore("use", "use"));
    });

    it("treats punctuation as a word boundary, so the second half of a slug is a word start", () => {
        expect(fuzzyScore("state", "use-state")).toBeGreaterThan(fuzzyScore("state", "usestate"));
    });

    it("prefers the text the query accounts for more of, within one match kind", () => {
        expect(fuzzyScore("api", "api")).toBeGreaterThan(fuzzyScore("api", "api client wrapper"));
    });

    it("never lets that preference outrank a better kind of match", () => {
        // A long title that *starts* with the query still beats a short one where it starts a
        // later word.
        expect(fuzzyScore("api", "api client wrapper for the gateway")).toBeGreaterThan(
            fuzzyScore("api", "an api"),
        );
    });

    describe("scattered matches", () => {
        it("are refused unless the field opts in", () => {
            expect(fuzzyScore("ustate", "useState")).toBe(0);
            expect(fuzzyScore("ustate", "useState", true)).toBeGreaterThan(0);
        });

        it("are refused when the letters are strewn across the text", () => {
            // The complaint this rule exists for: "test" is hiding in order inside almost any
            // sentence, so finding it there is not evidence the text is about it.
            expect(
                fuzzyScore(
                    "test",
                    "The theme toggle sets a cookie and reads the system setting",
                    true,
                ),
            ).toBe(0);
            expect(fuzzyScore("test", "unit tests for the parser", true)).toBeGreaterThan(0);
        });

        it("are refused for a query too short to mean anything scattered", () => {
            expect(fuzzyScore("use", "unit test setup", true)).toBe(0);
        });

        it("prefer the tighter of two spreads", () => {
            expect(fuzzyScore("abcd", "abcxd", true)).toBeGreaterThan(
                fuzzyScore("abcd", "abxcxd", true),
            );
        });
    });
});

describe("scoreRecord", () => {
    it("weighs a title hit above the same hit in a lower-weighted field", () => {
        expect(scoreRecord("hooks", fields("hooks", ""))).toBeGreaterThan(
            scoreRecord("hooks", fields("", "hooks")),
        );
    });

    it("requires every term to match something", () => {
        expect(scoreRecord("react hooks", fields("react hooks cheatsheet"))).toBeGreaterThan(0);
        expect(scoreRecord("react zebra", fields("react hooks cheatsheet"))).toBe(0);
    });

    it("lets the terms of a query match different fields", () => {
        expect(
            scoreRecord("react cleanup", fields("react hooks", "cleanup notes")),
        ).toBeGreaterThan(0);
    });

    it("scores zero for a blank query, so a caller can show its own default list", () => {
        expect(scoreRecord("", fields("react hooks"))).toBe(0);
        expect(scoreRecord("   ", fields("react hooks"))).toBe(0);
    });
});

describe("rankBySearch", () => {
    const records = [
        { id: "contains", title: "An api client" },
        { id: "exact", title: "api" },
        { id: "prefix", title: "api gateway notes" },
        { id: "unrelated", title: "postgres indexes" },
    ];

    const toFields = (record: (typeof records)[number]) => [{ text: record.title, weight: 1 }];

    it("returns the matches best first and drops the rest", () => {
        expect(rankBySearch("api", records, toFields, 10).map((record) => record.id)).toEqual([
            "exact",
            "prefix",
            "contains",
        ]);
    });

    it("caps the result count", () => {
        expect(rankBySearch("api", records, toFields, 2)).toHaveLength(2);
    });

    it("keeps the input order between equally good matches", () => {
        const tied = [
            { id: "first", title: "api docs" },
            { id: "second", title: "api docs" },
        ];

        expect(
            rankBySearch("api docs", tied, (record) => [{ text: record.title, weight: 1 }], 10).map(
                (record) => record.id,
            ),
        ).toEqual(["first", "second"]);
    });

    it("returns nothing for a blank query", () => {
        expect(rankBySearch("", records, toFields, 10)).toEqual([]);
    });
});
