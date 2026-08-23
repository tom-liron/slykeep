import { describe, expect, it } from "vitest";

import {
    CODE_LANGUAGES,
    DEFAULT_CODE_LANGUAGE,
    codeLanguageLabel,
    findCodeLanguage,
    toMonacoLanguage,
} from "./code-language";

describe("toMonacoLanguage", () => {
    it("falls back to plain text when no language is declared", () => {
        expect(toMonacoLanguage("")).toBe(DEFAULT_CODE_LANGUAGE);
        expect(toMonacoLanguage("   ")).toBe(DEFAULT_CODE_LANGUAGE);
    });

    it("resolves the aliases a developer would actually type", () => {
        expect(toMonacoLanguage("ts")).toBe("typescript");
        expect(toMonacoLanguage("py")).toBe("python");
        expect(toMonacoLanguage("bash")).toBe("shell");
        expect(toMonacoLanguage("c++")).toBe("cpp");
    });

    it("ignores case and surrounding whitespace", () => {
        expect(toMonacoLanguage("  TS  ")).toBe("typescript");
        expect(toMonacoLanguage("Python")).toBe("python");
    });

    it("passes through a language monaco already knows by name", () => {
        expect(toMonacoLanguage("typescript")).toBe("typescript");
        expect(toMonacoLanguage("sql")).toBe("sql");
    });

    it("passes through an unknown language rather than guessing", () => {
        // Monaco renders an id it does not recognize as plain text, which is the right outcome —
        // silently substituting a nearby language would highlight the content wrongly.
        expect(toMonacoLanguage("brainfuck")).toBe("brainfuck");
    });
});

describe("CODE_LANGUAGES", () => {
    it("offers every language the alias table can resolve to", () => {
        // The invariant that keeps the two tables in this module in one file. An alias resolving to
        // a language the list does not offer would leave an item stored as `zsh` with nothing to
        // select — the picker would render it as unlisted, which is the branch reserved for values
        // the aliases never knew about.
        const offered = new Set(CODE_LANGUAGES.map((language) => language.value));

        for (const alias of ["ts", "js", "py", "sh", "bash", "zsh", "yml", "c++", "c#", "md"]) {
            expect(offered.has(toMonacoLanguage(alias))).toBe(true);
        }
    });

    it("declares each language once, as a monaco id", () => {
        const values = CODE_LANGUAGES.map((language) => language.value);

        expect(new Set(values).size).toBe(values.length);
        // Picked values must survive `toMonacoLanguage` untouched, or the picker would write a
        // value it could not then read back as selected.
        for (const value of values) {
            expect(toMonacoLanguage(value)).toBe(value);
        }
    });

    it("is ordered by label, which is what the menu's typeahead reads", () => {
        const labels = CODE_LANGUAGES.map((language) => language.label);

        expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b)));
    });
});

describe("findCodeLanguage", () => {
    it("finds a language stored under an alias, or under a different case", () => {
        expect(findCodeLanguage("TS")?.label).toBe("TypeScript");
        expect(findCodeLanguage("bash")?.label).toBe("Shell");
        expect(findCodeLanguage("  Python  ")?.label).toBe("Python");
    });

    it("finds a language stored as its own id", () => {
        expect(findCodeLanguage("typescript")?.value).toBe("typescript");
    });

    it("returns null for a language the list does not offer, so the caller can preserve it", () => {
        expect(findCodeLanguage("brainfuck")).toBeNull();
    });

    it("returns null for an undeclared language rather than the plain-text fallback", () => {
        // `toMonacoLanguage("")` is `plaintext`, which is deliberately *not* in the list: an item
        // with no language is undeclared, and the picker shows that as "Plain text" while still
        // storing nothing. Listing it would give the same state two spellings, one of them truthy.
        expect(findCodeLanguage("")).toBeNull();
        expect(findCodeLanguage("   ")).toBeNull();
        expect(CODE_LANGUAGES.some((l) => l.value === DEFAULT_CODE_LANGUAGE)).toBe(false);
    });
});

describe("codeLanguageLabel", () => {
    it("writes the plain-text fallback as `text`", () => {
        expect(codeLanguageLabel(DEFAULT_CODE_LANGUAGE)).toBe("text");
        // Via the path the editor actually takes: an undeclared language resolves to the fallback
        // first, and only then is labelled.
        expect(codeLanguageLabel(toMonacoLanguage(""))).toBe("text");
    });

    it("shows every other language as monaco's own id", () => {
        expect(codeLanguageLabel("typescript")).toBe("typescript");
        expect(codeLanguageLabel("shell")).toBe("shell");
        // Including one monaco will not highlight: the header reports what it was told to use, and
        // claiming otherwise would hide why the content is not coloured.
        expect(codeLanguageLabel("brainfuck")).toBe("brainfuck");
    });
});
