/**
 * `Item.language` is a free-text field — a user types "TS", "bash", or "Python" — while monaco wants
 * one of its own language ids. This is the translation between the two, kept out of the editor
 * component so it can be tested as what it is: a pure lookup.
 */

/**
 * What users type versus what monaco calls that language. Only the aliases a developer would
 * actually write are here — anything monaco already knows by name (`typescript`, `python`, `sql`)
 * needs no entry, and anything it does not know renders as plain text.
 */
const LANGUAGE_ALIASES: Record<string, string> = {
    "c++": "cpp",
    "c#": "csharp",
    bash: "shell",
    fish: "shell",
    golang: "go",
    js: "javascript",
    jsx: "javascript",
    md: "markdown",
    py: "python",
    sh: "shell",
    ts: "typescript",
    tsx: "typescript",
    yml: "yaml",
    zsh: "shell",
};

/** What an item with no declared language is highlighted as. */
export const DEFAULT_CODE_LANGUAGE = "plaintext";

/** Normalizes a stored `Item.language` into a language id monaco will recognize. */
export function toMonacoLanguage(language: string): string {
    const normalized = language.trim().toLowerCase();

    if (!normalized) {
        return DEFAULT_CODE_LANGUAGE;
    }

    return LANGUAGE_ALIASES[normalized] ?? normalized;
}
