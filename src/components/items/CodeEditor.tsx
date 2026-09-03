"use client";

import { useState, useTransition } from "react";
import Editor, { loader, type BeforeMount, type OnMount } from "@monaco-editor/react";
import { Crown, Loader2, MessageSquareText } from "lucide-react";
import { Tabs as TabsPrimitive } from "radix-ui";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

import { explainCode } from "@/actions/ai";
import { useIsPro } from "@/components/layout/ProContext";
import { useEditorPreferences } from "@/components/settings/EditorPreferencesContext";
import { Button } from "@/components/ui/button";
import { EDITOR_MIN_HEIGHT, EDITOR_SURFACE, EDITOR_THEME_CATALOG } from "@/config/editor";
import { useCoarsePointer } from "@/hooks/use-coarse-pointer";
import { codeLanguageLabel, toMonacoLanguage } from "@/lib/code-language";
import { editorMaxHeight, renderedFontSize } from "@/lib/editor-metrics";
import { canUseAi } from "@/lib/limits";
import { MARKDOWN_PLUGINS } from "@/lib/markdown-plugins";
import { cn } from "@/lib/utils";
import type { ItemDraft } from "@/types/ai";
import type { EditorThemeId } from "@/types/editor";
import { ContentTextarea, EDITOR_PANEL, EDITOR_PANEL_BOUNDS } from "./ContentTextarea";

/**
 * The Monaco-based code editor for the item types whose content is code — the third of the three
 * content surfaces, beside `MarkdownEditor` and the plain `ContentTextarea` both share.
 *
 * Used in both directions: read-only in the drawer (replacing a `<pre>`) and editable in the
 * create and edit forms. Dressed as a small macOS window — window dots, a language label, and,
 * when the `explain` prop is passed (only by the drawer), the AI "explain this code" action as a
 * second tab. On a coarse pointer the *editable* direction falls back to `ContentTextarea`, since
 * Monaco does not support touch; the frame stays the same, so only the highlighting changes.
 *
 * Monaco itself is served from this origin (`public/monaco`, copied from `node_modules` by
 * `scripts/sync-monaco.ts`), not bundled and not from a CDN.
 *
 * @remarks
 * `@monaco-editor/react` ships its own default CDN build, a different Monaco version from the
 * `monaco-editor` package this file's option types come from, and the two drift (`hover.enabled` is
 * a boolean in one, a string union in the other). {@link loader}`.config` pins the runtime to the
 * installed copy so the checked types and the running code match.
 */
loader.config({ paths: { vs: "/monaco/vs" } });

// The editor's minimum height. Shared with `MarkdownEditor` through `config/editor.ts` so the two
// content surfaces take the same amount of the drawer. Aliased to the short name this file reads
// by. The ceiling is not a constant — it depends on the viewport, via `editorMaxHeight`.
const MIN_HEIGHT = EDITOR_MIN_HEIGHT;

/**
 * The one editor theme this app owns: chrome from its palette, syntax colours inherited from
 * `vs-dark`.
 *
 * Not a full theme — its colours are pinned to `EDITOR_SURFACE` rather than to the selected
 * theme's, so it stays the app's own surface whatever else is switched on.
 */
const THEME_NAME: EditorThemeId = "devstash-dark";

/**
 * The scrollbar, shared by every theme registered here.
 *
 * White alphas rather than per-theme colours, so one set works on all three surfaces — and because
 * `.app-scrollbar` in `globals.css` mirrors exactly these three to paint the *markdown* editor's
 * native scrollbar, which is plain CSS and cannot follow a monaco theme. Change these, change those.
 */
const SLIDER_COLORS = {
    "scrollbarSlider.background": "#ffffff1a",
    "scrollbarSlider.hoverBackground": "#ffffff2e",
    "scrollbarSlider.activeBackground": "#ffffff40",
};

/**
 * Registers the three themes that are not Monaco's own, on every mount.
 *
 * All three are `vs-dark` with `inherit: true`, so each is only the handful of colours that
 * distinguish it — Monaco falls back to `vs-dark` for everything else. All three are registered
 * regardless of which is selected, so the preference always has a theme to switch to.
 *
 * @remarks
 * `beforeMount`, not `onMount`: Monaco resolves the `theme` prop as it creates the editor, so a
 * theme registered afterwards is unknown when first needed.
 *
 * Each background is duplicated in `EDITOR_THEME_CATALOG` as `surface`, which paints the frame
 * around the editor, and the two must agree. Each name is `satisfies EditorThemeId` so renaming an
 * id in the catalog is a compile error rather than a silent fallback to the wrong colour.
 */
const defineTheme: BeforeMount = (monaco) => {
    monaco.editor.defineTheme(THEME_NAME, {
        base: "vs-dark",
        inherit: true,
        rules: [],
        colors: {
            "editor.background": EDITOR_SURFACE,
            "editorGutter.background": EDITOR_SURFACE,
            "editorLineNumber.foreground": "#525252",
            "editorLineNumber.activeForeground": "#a3a3a3",
            "editor.lineHighlightBackground": "#ffffff0a",
            "editor.lineHighlightBorder": "#00000000",
            "editorCursor.foreground": "#fafafa",
            "editorIndentGuide.background1": "#ffffff14",
            "editorIndentGuide.activeBackground1": "#ffffff2e",
            ...SLIDER_COLORS,
        },
    });

    monaco.editor.defineTheme("monokai" satisfies EditorThemeId, {
        base: "vs-dark",
        inherit: true,
        rules: [
            { token: "comment", foreground: "75715e", fontStyle: "italic" },
            { token: "string", foreground: "e6db74" },
            { token: "number", foreground: "ae81ff" },
            { token: "keyword", foreground: "f92672" },
            { token: "operator", foreground: "f92672" },
            { token: "delimiter", foreground: "f8f8f2" },
            { token: "type", foreground: "66d9ef", fontStyle: "italic" },
            { token: "function", foreground: "a6e22e" },
            { token: "variable", foreground: "f8f8f2" },
            { token: "tag", foreground: "f92672" },
            { token: "attribute.name", foreground: "a6e22e" },
            { token: "attribute.value", foreground: "e6db74" },
        ],
        colors: {
            "editor.background": "#272822",
            "editorGutter.background": "#272822",
            "editor.foreground": "#f8f8f2",
            "editorLineNumber.foreground": "#75715e",
            "editorLineNumber.activeForeground": "#f8f8f2",
            "editor.lineHighlightBackground": "#3e3d32",
            "editor.lineHighlightBorder": "#00000000",
            "editorCursor.foreground": "#f8f8f0",
            "editor.selectionBackground": "#49483e",
            ...SLIDER_COLORS,
        },
    });

    monaco.editor.defineTheme("github-dark" satisfies EditorThemeId, {
        base: "vs-dark",
        inherit: true,
        rules: [
            { token: "comment", foreground: "8b949e" },
            { token: "string", foreground: "a5d6ff" },
            { token: "number", foreground: "79c0ff" },
            { token: "keyword", foreground: "ff7b72" },
            { token: "operator", foreground: "ff7b72" },
            { token: "delimiter", foreground: "c9d1d9" },
            { token: "type", foreground: "ffa657" },
            { token: "function", foreground: "d2a8ff" },
            { token: "variable", foreground: "ffa657" },
            { token: "tag", foreground: "7ee787" },
            { token: "attribute.name", foreground: "79c0ff" },
            { token: "attribute.value", foreground: "a5d6ff" },
        ],
        colors: {
            "editor.background": "#0d1117",
            "editorGutter.background": "#0d1117",
            "editor.foreground": "#c9d1d9",
            "editorLineNumber.foreground": "#6e7681",
            "editorLineNumber.activeForeground": "#c9d1d9",
            "editor.lineHighlightBackground": "#161b22",
            "editor.lineHighlightBorder": "#00000000",
            "editorCursor.foreground": "#c9d1d9",
            "editor.selectionBackground": "#264f78",
            ...SLIDER_COLORS,
        },
    });
};

/**
 * The code editor described in the module header: one component for reading and writing, so a
 * snippet's header, chrome, and syntax colours do not change under the user mid-edit.
 *
 * @remarks
 * On a coarse pointer the editable direction renders `ContentTextarea` instead of Monaco — the
 * frame, header, and language label are the same, so only the highlighting differs between reading
 * and writing on a phone.
 */
export function CodeEditor({
    value,
    language,
    readOnly = false,
    onChange,
    id,
    label,
    placeholder,
    explain,
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
    /**
     * What to send the model when Explain is clicked. **Omit it and the whole feature is absent** —
     * no button, no tabs, no action import reached at runtime — which is how the create and edit
     * forms stay exactly as they were.
     *
     * A function rather than an `ItemDraft` value, matching `DescriptionField`'s `draft` prop: the
     * caller builds it at click time, so the request describes what is on screen now rather than
     * what was on screen when this rendered.
     */
    explain?: () => ItemDraft;
    "aria-invalid"?: boolean;
    "aria-describedby"?: string;
}) {
    const [height, setHeight] = useState(MIN_HEIGHT);
    /**
     * Whether the content is taller than the ceiling — the editor is scrolling itself and the last
     * visible line is a cut. Drives the bottom fade.
     */
    const [isClipped, setIsClipped] = useState(false);
    /** The explanation this editor has been given, or null while it has none. */
    const [explanation, setExplanation] = useState<string | null>(null);
    const [isExplaining, startExplaining] = useTransition();
    const [tab, setTab] = useState("code");

    // Font size, tab size, wrapping, the minimap, and the theme are the account's, from
    // `settings/EditorPreferencesContext`. Outside the dashboard layout there is no provider, and
    // the hook falls back to defaults.
    const preferences = useEditorPreferences();

    // Monaco does not support touch: it drives a hidden textarea the platform's caret handle,
    // selection grips and autocorrect bar cannot attach to, so placing a cursor mid-word on a
    // phone is a fight. Writing falls back to the plain textarea; reading keeps Monaco, since the
    // highlighting is what the read-only surface is for and there is no caret to place.
    const coarsePointer = useCoarsePointer();
    const plainText = coarsePointer && !readOnly;

    const monacoLanguage = toMonacoLanguage(language);

    // The frame is painted here, outside monaco, so it has to be told what the chosen theme is about
    // to paint its body — otherwise the header band and border stay one colour while the editor
    // changes underneath them.
    const surface = EDITOR_THEME_CATALOG[preferences.theme].surface;

    // Controls appearance, not access: `explainCode` re-checks entitlement and item type
    // server-side. Unlike the AI buttons in the forms, this one stays visible for a free account,
    // disabled with a crown, so the feature is discoverable in the editor's chrome. `canExplain`
    // therefore gates the action, not the button.
    const canExplain = canUseAi(useIsPro());

    // Pinned to the code tab until there is a second tab to switch to, so nothing can leave the
    // editor showing a panel that holds nothing — the same guard `MarkdownEditor` applies with
    // `readOnly ? "preview" : tab`.
    const activeTab = explanation === null ? "code" : tab;

    const requestExplanation = () => {
        startExplaining(async () => {
            const result = await explainCode(explain!());

            if (!result.success) {
                toast.error(result.error);

                return;
            }

            setExplanation(result.data.explanation);
            // Switches to the answer on arrival rather than adding a tab the user has to notice and
            // click.
            setTab("explain");
        });
    };

    // Fluid up to a ceiling: Monaco reports its content height (wrapped lines included) and the
    // wrapper follows it until the ceiling, past which the editor scrolls itself. The ceiling
    // depends on the viewport, so this also listens for `resize` — Monaco's `automaticLayout`
    // watches only the width of its box. `onDidDispose`, not an effect cleanup, because Monaco owns
    // the editor this closure measures.
    const handleMount: OnMount = (editor) => {
        const measure = () => {
            const ceiling = editorMaxHeight(window.innerHeight);
            const content = Math.max(MIN_HEIGHT, editor.getContentHeight());

            setHeight(Math.min(ceiling, content));
            setIsClipped(content > ceiling);
        };

        measure();
        editor.onDidContentSizeChange(measure);
        window.addEventListener("resize", measure);
        editor.onDidDispose(() => window.removeEventListener("resize", measure));

        if (id) {
            // Monaco owns the textarea it renders, so this is the only way to give the `Field`
            // label a target; without it the `htmlFor` above would point at nothing.
            editor.getDomNode()?.querySelector("textarea")?.setAttribute("id", id);
        }
    };

    return (
        // A tabs root even when there is only one tab (every editor outside the drawer): Radix
        // renders a plain div, and the conditional tab list is the only difference, so the frame
        // stays one piece of markup. `MarkdownEditor` is built the same way.
        <TabsPrimitive.Root
            value={activeTab}
            onValueChange={setTab}
            className="overflow-hidden rounded-lg border border-border aria-invalid:border-destructive"
            style={{ backgroundColor: surface }}
            aria-invalid={ariaInvalid}
            aria-describedby={ariaDescribedBy}
        >
            {/* `flex-wrap` because this row is inside an `overflow-hidden` box within an
                `overflow-x-hidden` drawer, so a row that does not fit loses its right-hand end
                rather than gaining a scrollbar. With both tabs, the AI button and the language
                label it is wider than the drawer at phone width; wrapping drops the trailing group
                to a second line there and changes nothing wider. */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 border-b border-border px-3 py-2">
                {/* Window dots — decoration, not controls, so they are hidden from assistive tech. */}
                <div className="flex items-center gap-1.5" aria-hidden="true">
                    <span className="size-2.5 rounded-full bg-[#ff5f57]" />
                    <span className="size-2.5 rounded-full bg-[#febc2e]" />
                    <span className="size-2.5 rounded-full bg-[#28c840]" />
                </div>

                {/* Only once there is an explanation to switch to — a lone "Code" tab would be
                    chrome that does nothing, on every form in the app. */}
                {explanation !== null && (
                    <TabsPrimitive.List className="flex items-center gap-1" aria-label={label}>
                        <Tab value="code">Code</Tab>
                        <Tab value="explain">Explain</Tab>
                    </TabsPrimitive.List>
                )}

                {/* No copy button here: the drawer's action bar already has one that copies this
                    content, in the same place for every item type. Explain lives in this header
                    rather than that bar because it applies to only two of the seven types, and the
                    bar holds what is true of all of them. */}
                <div className="ml-auto flex items-center gap-2">
                    {explain && (
                        <ExplainButton
                            canExplain={canExplain}
                            isExplaining={isExplaining}
                            hasExplanation={explanation !== null}
                            onClick={requestExplanation}
                        />
                    )}

                    {/* The label, not the id: `monacoLanguage` is what the editor below is told to
                        highlight as, and `plaintext` is a poor thing to show a person. */}
                    <span className="font-mono text-[11px] text-muted-foreground">
                        {codeLanguageLabel(monacoLanguage)}
                    </span>
                </div>
            </div>

            {/* Force-mounted and hidden by class rather than unmounted, as `MarkdownEditor` keeps
                its Write tab alive. Monaco loads several megabytes, measures its content height on
                mount, and holds the reader's scroll position; unmounting it to look at the
                explanation would lose all three and flash a re-measuring editor on return. */}
            <TabsPrimitive.Content value="code" forceMount className="data-[state=inactive]:hidden">
                {/* The fallback keeps the frame, header and language label — only the highlighting
                    is lost, and the item reads back highlighted once saved and viewed. Rendered
                    *instead of* `<Editor>`, not hidden alongside it, so Monaco never mounts on a
                    phone and never loads its several megabytes. */}
                {plainText ? (
                    <ContentTextarea
                        id={id}
                        value={value}
                        onChange={onChange}
                        placeholder={placeholder}
                        label={label}
                        code
                    />
                ) : (
                    // `relative`, only so the fade below has something to be absolute against. It
                    // wraps rather than replaces the editor's own box, so monaco still measures and
                    // lays out exactly as it did.
                    <div className="relative">
                        <Editor
                            height={height}
                            language={monacoLanguage}
                            value={value}
                            // The preference *is* the monaco theme name: `devstash-dark` is the one registered
                            // above, and the rest are built in.
                            theme={preferences.theme}
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
                                minimap: { enabled: preferences.minimap },
                                overviewRulerLanes: 0,
                                overviewRulerBorder: false,
                                hideCursorInOverviewRuler: true,
                                folding: false,
                                glyphMargin: false,
                                lineNumbersMinChars: 3,
                                lineDecorationsWidth: 8,
                                // A preference, defaulting to wrapping: the drawer is narrow, and a
                                // long line scrolled sideways is worse than a wrapped one. Turning
                                // it off also shortens the measured content height, so the editor
                                // box gets smaller, not just narrower in reach.
                                wordWrap: preferences.wordWrap ? "on" : "off",
                                fontFamily: "var(--font-mono)",
                                // Floored under a finger, which here is the read-only drawer: monaco's textarea
                                // is focusable even when it is read-only, and iOS zooms the page in on focus at
                                // anything under 16px. The stored preference is untouched — see
                                // `renderedFontSize`.
                                fontSize: renderedFontSize(preferences.fontSize, coarsePointer),
                                tabSize: preferences.tabSize,
                                padding: { top: 12, bottom: 12 },
                                contextmenu: !readOnly,
                                stickyScroll: { enabled: false },
                            }}
                        />
                        {/* A bottom fade marking that the content is clipped, so the cut last line
                            reads as "scroll for more" rather than a rendering fault. Shown only
                            when `isClipped` — the box is fluid up to a ceiling, so most snippets
                            end where their content ends and need no fade.

                            Faded to `${surface}00`, not `transparent`: `transparent` is transparent
                            *black*, and browsers interpolate in premultiplied sRGB, so
                            `#272822 → transparent` passes through a grey haze. The same hue at zero
                            alpha interpolates cleanly. `pointer-events-none` so it never eats a
                            click, drag, or selection reaching the lines under it. */}
                        {isClipped && (
                            <div
                                aria-hidden="true"
                                className="pointer-events-none absolute inset-x-0 bottom-0 h-8"
                                style={{
                                    backgroundImage: `linear-gradient(to top, ${surface}, ${surface}00)`,
                                }}
                            />
                        )}
                    </div>
                )}
            </TabsPrimitive.Content>

            {/* Rendered only once the explanation exists; `activeTab` also refuses to select it
                before then. Uses the same surface, bounds and `.markdown-preview` ramp as
                `MarkdownEditor`'s Preview tab, so an explanation and a rendered note read as one
                surface. */}
            {explanation !== null && (
                <TabsPrimitive.Content
                    value="explain"
                    style={EDITOR_PANEL_BOUNDS}
                    className={cn(EDITOR_PANEL, "px-3 py-3")}
                >
                    <div className="markdown-preview">
                        <ReactMarkdown remarkPlugins={MARKDOWN_PLUGINS}>
                            {explanation}
                        </ReactMarkdown>
                    </div>
                </TabsPrimitive.Content>
            )}
        </TabsPrimitive.Root>
    );
}

/** One tab in the editor's header row: muted until selected. */
function Tab({ value, children }: { value: string; children: React.ReactNode }) {
    return (
        <TabsPrimitive.Trigger
            value={value}
            className="rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground data-[state=active]:bg-muted data-[state=active]:text-foreground"
        >
            {children}
        </TabsPrimitive.Trigger>
    );
}

/**
 * The "explain this code" control in the editor's chrome, shown only when `CodeEditor` has an
 * `explain` prop.
 *
 * Sized and styled as `ItemFormFields`' `SuggestButton` — ghost, `h-7`, `text-xs`, a `size-3.5`
 * icon — so the app's three AI buttons read as one control in three places.
 *
 * `MessageSquareText`, not `Sparkles`: `Sparkles` is the Prompt type's icon, and a glyph learned
 * as "prompt" elsewhere in the app must not also mean "explain" here. A speech bubble with text is
 * the answer coming back, which is what this produces — prose about the code, not a transformation
 * of it, so it names the action the way the description button's `PenLine` does.
 *
 * A free account gets `Crown` and a disabled button, keeping the word "Explain".
 *
 * @remarks
 * This is the only icon in an otherwise spare header (flat dots, muted tabs, a mono label), so a
 * replacement stays light and geometric: the word beside it carries the meaning, and a
 * many-stroke glyph turns to mush at `size-3.5`.
 */
function ExplainButton({
    canExplain,
    isExplaining,
    hasExplanation,
    onClick,
}: {
    canExplain: boolean;
    isExplaining: boolean;
    hasExplanation: boolean;
    onClick: () => void;
}) {
    // Native `title` rather than a tooltip component, which this app does not have — the same thing
    // `SuggestButton` does with its own label. `aria-label` carries it for assistive tech, since a
    // `title` alone is not reliably announced.
    const label = canExplain
        ? hasExplanation
            ? "Explain this code with AI again"
            : "Explain this code with AI"
        : "AI features require Pro subscription";

    return (
        <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClick}
            // Inert for a free account, not a link to the upgrade page: navigating away from an
            // item someone is reading is the bigger surprise.
            disabled={!canExplain || isExplaining}
            aria-label={label}
            title={label}
            // The hover fill is a white alpha, overriding the ghost variant's `bg-muted`, for the
            // reason `SLIDER_COLORS` above is: this header's colour comes from
            // `EDITOR_THEME_CATALOG`'s fixed monaco surfaces, not a theme token, so a `--muted`
            // grey would land differently on each and vanish under light mode, where the chrome
            // stays dark. 10% matches `scrollbarSlider.background` (`#ffffff1a`) to the digit, so
            // the two things that light up in this frame light up by the same amount.
            className="-my-1 h-7 gap-1.5 px-2 text-xs hover:bg-white/10 dark:hover:bg-white/10"
        >
            {!canExplain ? (
                <Crown className="size-3.5" aria-hidden="true" />
            ) : isExplaining ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            ) : (
                <MessageSquareText className="size-3.5" aria-hidden="true" />
            )}
            <span>{isExplaining ? "Explaining…" : "Explain"}</span>
        </Button>
    );
}
