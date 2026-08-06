"use client";

import { useState } from "react";
import Editor, { loader, type BeforeMount, type OnMount } from "@monaco-editor/react";

import { EDITOR_MAX_HEIGHT, EDITOR_MIN_HEIGHT, EDITOR_SURFACE } from "@/config/editor";
import { toMonacoLanguage } from "@/lib/code-language";

/**
 * The wrapper ships its own default CDN build, which is a *different* monaco version from the
 * `monaco-editor` package this file's option types come from — and the two do drift: `hover.enabled`
 * is a boolean in one and a string union in the other. Pinning the runtime to the installed version
 * keeps what TypeScript checks and what the browser actually runs the same thing. `monaco-editor` is
 * pinned exactly in `package.json` for that reason — bump it and this string together, or not at all.
 */
loader.config({
    paths: { vs: "https://cdn.jsdelivr.net/npm/monaco-editor@0.56.0/min/vs" },
});

// Shared with `MarkdownEditor` through `config/editor.ts`, so the two content surfaces cannot drift
// apart on colour or on how much of the drawer they take. Aliased to the short names this file
// already reads by.
const SURFACE = EDITOR_SURFACE;
const MIN_HEIGHT = EDITOR_MIN_HEIGHT;
const MAX_HEIGHT = EDITOR_MAX_HEIGHT;

/**
 * Chrome from the app's palette, syntax colours inherited from `vs-dark`.
 *
 * Deliberately not a full theme: picking our own token colours would mean maintaining a second
 * syntax palette for every language monaco supports, to no benefit. What is overridden is only what
 * would otherwise look foreign inside the app — the surface, the gutter, and the scrollbar.
 */
const THEME_NAME = "devstash-dark";

const defineTheme: BeforeMount = (monaco) => {
    monaco.editor.defineTheme(THEME_NAME, {
        base: "vs-dark",
        inherit: true,
        rules: [],
        colors: {
            "editor.background": SURFACE,
            "editorGutter.background": SURFACE,
            "editorLineNumber.foreground": "#525252",
            "editorLineNumber.activeForeground": "#a3a3a3",
            "editor.lineHighlightBackground": "#ffffff0a",
            "editor.lineHighlightBorder": "#00000000",
            "editorCursor.foreground": "#fafafa",
            "editorIndentGuide.background1": "#ffffff14",
            "editorIndentGuide.activeBackground1": "#ffffff2e",
            // Mirrored in CSS by `.editor-scrollbar` in `globals.css`, which is how the markdown
            // editor's native scrollbar is made to match this one. Change these three, change those.
            "scrollbarSlider.background": "#ffffff1a",
            "scrollbarSlider.hoverBackground": "#ffffff2e",
            "scrollbarSlider.activeBackground": "#ffffff40",
        },
    });
};

/**
 * Monaco, dressed as a small macOS window, for the item types whose content is code.
 *
 * It is used in both directions: read-only in the drawer, where it replaces the plain `<pre>`, and
 * editable in the create and edit forms, where it replaces the monospace textarea. One component for
 * both keeps a snippet looking identical whether it is being read or written — the header, the
 * chrome, and the syntax colours do not change under the user mid-edit.
 *
 * Monaco itself is not bundled. `@monaco-editor/react` fetches it from a CDN on first mount, which
 * is why this costs a few kB here rather than the several megabytes monaco actually weighs; the
 * trade is that the editor needs a network the first time it is shown, and nothing renders offline.
 * That is the one thing to revisit if the app ever has to run air-gapped.
 */
export function CodeEditor({
    value,
    language,
    readOnly = false,
    onChange,
    id,
    label,
    placeholder,
    "aria-invalid": ariaInvalid,
    "aria-describedby": ariaDescribedBy,
}: {
    value: string;
    language: string;
    readOnly?: boolean;
    onChange?: (value: string) => void;
    /** Handed to monaco's own textarea so the `Field` label above it points at something real. */
    id?: string;
    /** The editor's accessible name, since the visible label is not wired to a native control. */
    label: string;
    placeholder?: string;
    "aria-invalid"?: boolean;
    "aria-describedby"?: string;
}) {
    const [height, setHeight] = useState(MIN_HEIGHT);

    const monacoLanguage = toMonacoLanguage(language);

    // Fluid up to a ceiling: monaco reports how tall its content actually is — wrapped lines
    // included — and the wrapper follows it until 400px, past which the editor scrolls itself.
    const handleMount: OnMount = (editor) => {
        const measure = () =>
            setHeight(Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, editor.getContentHeight())));

        measure();
        editor.onDidContentSizeChange(measure);

        if (id) {
            // Monaco owns the textarea it renders, so this is the only way to give the `Field`
            // label a target; without it the `htmlFor` above would point at nothing.
            editor.getDomNode()?.querySelector("textarea")?.setAttribute("id", id);
        }
    };

    return (
        <div
            className="overflow-hidden rounded-lg border border-border aria-invalid:border-destructive"
            style={{ backgroundColor: SURFACE }}
            aria-invalid={ariaInvalid}
            aria-describedby={ariaDescribedBy}
        >
            <div className="flex items-center gap-2 border-b border-border px-3 py-2">
                {/* Window dots — decoration, not controls, so they are hidden from assistive tech. */}
                <div className="flex items-center gap-1.5" aria-hidden="true">
                    <span className="size-2.5 rounded-full bg-[#ff5f57]" />
                    <span className="size-2.5 rounded-full bg-[#febc2e]" />
                    <span className="size-2.5 rounded-full bg-[#28c840]" />
                </div>

                {/* No copy button here. The drawer's action bar already has one, in the same place
                    for every item type, and it copies this exact content; a second one on the block
                    itself was the same action twice. In the create and edit forms it would be the
                    only one — but copying is not what those are for. */}
                <span className="ml-auto font-mono text-[11px] text-muted-foreground">
                    {monacoLanguage}
                </span>
            </div>

            <Editor
                height={height}
                language={monacoLanguage}
                value={value}
                theme={THEME_NAME}
                beforeMount={defineTheme}
                onMount={handleMount}
                onChange={(next) => onChange?.(next ?? "")}
                loading={<div className="size-full animate-pulse bg-muted/40" />}
                options={{
                    readOnly,
                    domReadOnly: readOnly,
                    ariaLabel: label,
                    placeholder,
                    automaticLayout: true,
                    scrollBeyondLastLine: false,
                    // The editor lives inside a scrolling drawer and a scrolling dialog. Consuming
                    // the wheel would trap the page's scroll the moment the pointer crossed it.
                    scrollbar: {
                        alwaysConsumeMouseWheel: false,
                        verticalScrollbarSize: 10,
                        horizontalScrollbarSize: 10,
                        useShadows: false,
                    },
                    // A stash, not an IDE: nothing here has a project or a type-checker behind it,
                    // so suggestions and hovers would only ever be noise over stored text.
                    quickSuggestions: false,
                    suggestOnTriggerCharacters: false,
                    parameterHints: { enabled: false },
                    hover: { enabled: "off" },
                    occurrencesHighlight: "off",
                    renderLineHighlight: readOnly ? "none" : "line",
                    minimap: { enabled: false },
                    overviewRulerLanes: 0,
                    overviewRulerBorder: false,
                    hideCursorInOverviewRuler: true,
                    folding: false,
                    glyphMargin: false,
                    lineNumbersMinChars: 3,
                    lineDecorationsWidth: 8,
                    // Wrapping rather than a horizontal scrollbar: the drawer is narrow, and a long
                    // line that has to be scrolled sideways to be read is worse than a wrapped one.
                    wordWrap: "on",
                    fontFamily: "var(--font-mono)",
                    fontSize: 13,
                    tabSize: 2,
                    padding: { top: 12, bottom: 12 },
                    contextmenu: !readOnly,
                    stickyScroll: { enabled: false },
                }}
            />
        </div>
    );
}
