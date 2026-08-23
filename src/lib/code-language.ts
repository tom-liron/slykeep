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

/**
 * The languages the item forms offer, as `{ value, label }` pairs.
 *
 * `value` is monaco's own language id, which is what makes this list worth having beyond the
 * convenience of not typing: everything picked here passes through `toMonacoLanguage` untouched, so
 * new items no longer depend on the alias table above to highlight correctly. That table stays for
 * the items already stored — and for anything typed before this list existed.
 *
 * It lives here rather than in `config/` (where `EDITOR_THEME_CATALOG` sits) because of the
 * invariant between the two tables in this file: every alias should resolve to a language this list
 * offers, or the picker cannot show what an aliased item already is. One module is what lets a test
 * assert that; two would let them drift.
 *
 * Ordered by label so a 30-item menu is scannable. Radix gives the menu typeahead over that same
 * label, so "ty" reaches TypeScript without scrolling — which is why this does not need to become a
 * searchable combobox.
 *
 * Curated, not exhaustive: monaco knows roughly ninety languages, most of which nobody stashes a
 * snippet of. A language that is missing is a one-line addition here.
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
 * Resolved through `toMonacoLanguage` first, so an item stored as `TS` — or `Bash`, or `py` — finds
 * TypeScript rather than falling through as unknown. The picker only has to render a value as its
 * own option when this returns `null`, which is the case that would otherwise lose data: a language
 * typed before the list existed and not covered by an alias.
 *
 * An empty or whitespace-only language is not "unknown", it is *undeclared*, and the picker renders
 * that as its own choice — so this returns `null` for it too and the caller distinguishes the two by
 * testing the raw string.
 */
export function findCodeLanguage(language: string): { value: string; label: string } | null {
    const id = toMonacoLanguage(language);

    return CODE_LANGUAGES.find((candidate) => candidate.value === id) ?? null;
}

/**
 * How a monaco language id is written in UI chrome — the editor's header band.
 *
 * Only one id is rewritten: `plaintext` reads as `text`. It is the one label that names the absence
 * of a language rather than a language, and the header is a cramped monospace corner where the extra
 * five characters buy nothing. Everything else is monaco's id verbatim, which is the honest thing to
 * show — the header's job is to say what the content is being highlighted *as*.
 *
 * Separate from `LanguageField`'s "Plain text" on purpose. Both name the same state, in the register
 * each surface is written in: a form control gets a readable phrase, a title bar gets a token.
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
