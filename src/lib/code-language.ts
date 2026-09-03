/**
 * The translation between a stored `Item.language` and a monaco language id.
 *
 * `Item.language` is a free-text field — a user types "TS", "bash" or "Python" — while the code
 * editor and the file preview want one of monaco's own ids. `CodeEditor` and `LanguageField` call
 * {@link toMonacoLanguage}, {@link findCodeLanguage} and {@link codeLanguageLabel}; kept out of the
 * editor component so the lookup can be unit-tested on its own.
 */

/**
 * The aliases a developer writes versus the id monaco knows the language by. Only aliases are
 * listed — anything monaco already knows by name (`typescript`, `python`, `sql`) needs no entry,
 * and anything it does not know renders as plain text.
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

/**
 * The languages the item forms offer, as `{ value, label }` pairs, where `value` is monaco's own id.
 *
 * @remarks
 * A picked value passes through {@link toMonacoLanguage} unchanged, so an item created from this
 * list does not depend on {@link LANGUAGE_ALIASES} to highlight; the alias table serves items
 * stored as free text. This list lives here rather than in `config/` because of the invariant
 * between the two tables — every alias should resolve to a language this list offers, or the picker
 * cannot show what an aliased item already is — which one module lets a test assert. Ordered by
 * label; Radix gives the menu typeahead over the label, so it needs no combobox. Curated, not
 * exhaustive: monaco knows ~90 languages, and a missing one is a one-line addition here.
 */
export const CODE_LANGUAGES: readonly { value: string; label: string }[] = [
    { value: "c", label: "C" },
    { value: "csharp", label: "C#" },
    { value: "cpp", label: "C++" },
    { value: "css", label: "CSS" },
    { value: "dart", label: "Dart" },
    { value: "dockerfile", label: "Dockerfile" },
    { value: "go", label: "Go" },
    { value: "graphql", label: "GraphQL" },
    { value: "html", label: "HTML" },
    { value: "ini", label: "INI" },
    { value: "java", label: "Java" },
    { value: "javascript", label: "JavaScript" },
    { value: "json", label: "JSON" },
    { value: "kotlin", label: "Kotlin" },
    { value: "lua", label: "Lua" },
    { value: "markdown", label: "Markdown" },
    { value: "objective-c", label: "Objective-C" },
    { value: "perl", label: "Perl" },
    { value: "php", label: "PHP" },
    { value: "powershell", label: "PowerShell" },
    { value: "python", label: "Python" },
    { value: "r", label: "R" },
    { value: "ruby", label: "Ruby" },
    { value: "rust", label: "Rust" },
    { value: "scss", label: "SCSS" },
    { value: "shell", label: "Shell" },
    { value: "sql", label: "SQL" },
    { value: "swift", label: "Swift" },
    { value: "typescript", label: "TypeScript" },
    { value: "xml", label: "XML" },
    { value: "yaml", label: "YAML" },
];

/**
 * The option matching a stored `Item.language`, or `null` for one this list does not offer.
 *
 * Resolved through {@link toMonacoLanguage} first, so an item stored as `TS`, `Bash` or `py` finds
 * its option. A `null` return is the case the picker has to render as its own option — a language
 * typed before the list existed and not covered by an alias. An empty or whitespace-only language
 * is undeclared rather than unknown and also returns `null`; the caller tells the two apart by the
 * raw string.
 */
export function findCodeLanguage(language: string): { value: string; label: string } | null {
    const id = toMonacoLanguage(language);

    return CODE_LANGUAGES.find((candidate) => candidate.value === id) ?? null;
}

/**
 * How a monaco language id is written in the editor's header band.
 *
 * Only `plaintext` is rewritten, to `text`: it names the absence of a language, and the header is a
 * cramped monospace corner. Everything else is monaco's id verbatim. `LanguageField` names the same
 * state as "Plain text" — a form control gets a readable phrase, a title bar gets a token.
 */
export function codeLanguageLabel(monacoLanguage: string): string {
    return monacoLanguage === DEFAULT_CODE_LANGUAGE ? "text" : monacoLanguage;
}

/** Normalizes a stored `Item.language` into a language id monaco will recognize. */
export function toMonacoLanguage(language: string): string {
    const normalized = language.trim().toLowerCase();

    if (!normalized) {
        return DEFAULT_CODE_LANGUAGE;
    }

    return LANGUAGE_ALIASES[normalized] ?? normalized;
}
