import { describe, expect, it } from "vitest";

import { DEFAULT_CODE_LANGUAGE, toMonacoLanguage } from "./code-language";

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
