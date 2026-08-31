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
// apart on how much of the drawer they take — the colour they share now comes from the theme
// catalog in the same file. Aliased to the short name this file already reads by; the ceiling is no
// longer a constant, since it depends on the viewport (see `editorMaxHeight`).
const MIN_HEIGHT = EDITOR_MIN_HEIGHT;

/**
 * The one theme this app owns: chrome from its palette, syntax colours inherited from `vs-dark`.
 *
 * Deliberately not a full theme, and its colours stay pinned to `EDITOR_SURFACE` rather than the
 * selected theme's — this *is* the app's theme, not a copy of whatever is switched on.
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
 * Registers the three themes that are not monaco's own, on every mount.
 *
 * All three are `vs-dark` with `inherit: true`, which is what makes them small: monaco falls back to
 * `vs-dark` for every token type and UI colour not named below, so a theme is the handful of colours
 * that actually distinguish it rather than a table covering every language. They are all registered
 * regardless of which one is selected — defining a theme is assigning an object, and the alternative
 * is registering on demand and having nothing to switch *to* when the preference changes.
 *
 * `beforeMount` and not `onMount`: monaco resolves the `theme` prop as it creates the editor, so a
 * theme registered afterwards is unknown at exactly the moment it is first needed.
 *
 * The token colours are the two themes' own published palettes, trimmed to the scopes monaco's
 * tokenizers actually emit. Backgrounds are duplicated in `EDITOR_THEME_CATALOG` as `surface`,
 * which is what the frame around the editor is painted with — the two must agree.
 *
 * Each name is `satisfies EditorThemeId` rather than a bare string, because monaco does not complain
 * about a theme it was never given: rename an id in the catalog and the preference would resolve to
 * nothing, monaco would quietly fall back, and the failure would be a wrong colour rather than an
 * error. This makes that a compile error instead.
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
 *
 * One exception to "one component for both": under a coarse pointer the *editable* direction is a
 * plain textarea, because monaco does not support touch. The frame, the header and the language
 * label are the same either way, so what changes between reading and writing on a phone is the
 * highlighting and nothing else.
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
     * Whether the content is taller than the ceiling — i.e. the editor is scrolling itself, and the
     * last visible line is a cut rather than the end of the file. Drives the fade below; see the
     * note there for why it is measured rather than always on.
     */
    const [isClipped, setIsClipped] = useState(false);
    /** The explanation this editor has been given, or null while it has none. */
    const [explanation, setExplanation] = useState<string | null>(null);
    const [isExplaining, startExplaining] = useTransition();
    const [tab, setTab] = useState("code");

    // Font size, tab size, wrapping, the minimap, and the theme are the account's, not this
    // component's — see `settings/EditorPreferencesContext`. Outside the dashboard layout there is
    // no provider, and the hook falls back to the same values this file used to hardcode.
    const preferences = useEditorPreferences();

    // Monaco does not support touch. It renders its own DOM and drives a hidden textarea, so the
    // platform's caret handle, selection grips, magnifier and autocorrect bar have nothing to attach
    // to — placing a cursor mid-word on a phone is a fight, which is not a state to leave someone in
    // while they are trying to save a snippet. Writing therefore falls back to the plain textarea
    // the markdown editor already uses; reading keeps monaco, because the highlighting is the point
    // of the read-only surface and there is no caret to place.
    const coarsePointer = useCoarsePointer();
    const plainText = coarsePointer && !readOnly;

    const monacoLanguage = toMonacoLanguage(language);

    // The frame is painted here, outside monaco, so it has to be told what the chosen theme is about
    // to paint its body — otherwise the header band and border stay one colour while the editor
    // changes underneath them.
    const surface = EDITOR_THEME_CATALOG[preferences.theme].surface;

    // What is shown, not what is enforced: `explainCode` runs this same check server-side, and it
    // also re-checks the item type, so a free account that reaches the action by hand is refused.
    // Unlike the two AI buttons in the forms — which hide themselves from a free account — this one
    // stays on screen wearing a crown, because the surface it sits on is different: a form's field
    // row reads as complete without it, while a control missing from the editor's chrome is a
    // feature nobody discovers. That is the spec's call, and it is why `canExplain` gates the
    // *action* here rather than the button's existence.
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
            // Switches on arrival rather than waiting to be clicked. The user asked a question and
            // this is the answer; leaving them on the code with a new tab quietly added beside it
            // would make them ask for it twice.
            setTab("explain");
        });
    };

    // Fluid up to a ceiling: monaco reports how tall its content actually is — wrapped lines
    // included — and the wrapper follows it until the ceiling, past which the editor scrolls itself.
    //
    // The ceiling depends on the viewport now, so this also listens for `resize` — rotating a phone
    // is exactly the case it exists for, and monaco's `automaticLayout` only watches the *width* of
    // the box it was given. `onDidDispose` rather than an effect cleanup because monaco owns this
    // listener's lifetime: the editor is what the closure measures.
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
        // A tabs root even when there is only ever one tab, which is every editor outside the
        // drawer. Radix renders a plain div and the header's list is what is conditional, so the
        // alternative — a div here and a root there — would be two versions of the frame to keep
        // matching. `MarkdownEditor` is built the same way for the same reason.
        <TabsPrimitive.Root
            value={activeTab}
            onValueChange={setTab}
            className="overflow-hidden rounded-lg border border-border aria-invalid:border-destructive"
            style={{ backgroundColor: surface }}
            aria-invalid={ariaInvalid}
            aria-describedby={ariaDescribedBy}
        >
            {/* `flex-wrap`, because this row lives inside an `overflow-hidden` box and the drawer
                that hosts it is `overflow-x-hidden` too — so a row that does not fit is not a
                scrollbar, it is the right-hand end silently disappearing. With both tabs showing
                it needs ~330px between the window dots, the two tabs, the AI button and the
                language, and the drawer offers 288px at 320px wide. Wrapping moves the trailing
                group down a line at that width and changes nothing at any other. */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 border-b border-border px-3 py-2">
                {/* Window dots — decoration, not controls, so they are hidden from assistive tech. */}
                <div className="flex items-center gap-1.5" aria-hidden="true">
                    <span className="size-2.5 rounded-full bg-[#ff5f57]" />
                    <span className="size-2.5 rounded-full bg-[#febc2e]" />
                    <span className="size-2.5 rounded-full bg-[#28c840]" />
                </div>

                {/* Only once there is something to switch to. A lone "Code" tab beside the dots
                    would be chrome that does nothing, and it would appear on every form in the app
                    to serve a feature only the drawer has. */}
                {explanation !== null && (
                    <TabsPrimitive.List className="flex items-center gap-1" aria-label={label}>
                        <Tab value="code">Code</Tab>
                        <Tab value="explain">Explain</Tab>
                    </TabsPrimitive.List>
                )}

                {/* No copy button here. The drawer's action bar already has one, in the same place
                    for every item type, and it copies this exact content; a second one on the block
                    itself was the same action twice. In the create and edit forms it would be the
                    only one — but copying is not what those are for.

                    Explain is the exception, and the reason is that same action bar: it holds what
                    is true of *every* item type, and this is true of two. A button there would have
                    to be absent for five of the seven types, which is a worse thing for a toolbar
                    to be than short. */}
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

            {/* Force-mounted and hidden by class rather than unmounted, the way `MarkdownEditor`
                keeps its Write tab alive. Monaco is not a control that can be thrown away and
                rebuilt cheaply: it fetches several megabytes from a CDN, measures its own content
                height on mount, and holds the scroll position the reader left off at. Unmounting it
                to look at the explanation would lose all three, and coming back would flash a
                re-measuring editor at someone who only switched tabs. */}
            <TabsPrimitive.Content value="code" forceMount className="data-[state=inactive]:hidden">
                {/* The fallback keeps the frame, the header and the language label — everything except
                the highlighting, which is what a plain textarea cannot do. It stays honest about
                what the content is: the label above still says `typescript`, and the item reads back
                highlighted the moment it is saved and viewed.

                Rendering it *instead of* `<Editor>`, rather than hiding one of the two, is also what
                keeps monaco off the phone: `@monaco-editor/react` fetches several megabytes from a
                CDN when the editor mounts, and a surface that never mounts never asks. */}
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
                                // Wrapping rather than a horizontal scrollbar is the default, because the drawer
                                // is narrow and a long line scrolled sideways is worse than a wrapped one — but
                                // it is a preference now, since that trade is the user's to make for their own
                                // content. Turning it off also shortens the measured content height, which is
                                // the height of the box: the editor gets smaller, not just narrower in reach.
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
                        {/* A cut line is the one thing a reader cannot tell from a finished one, and
                            this editor cuts mid-glyph — the drawer scrolls, the editor scrolls
                            inside it, and the bottom edge of a clipped snippet looked like a
                            rendering fault rather than an invitation to keep scrolling.

                            Measured rather than always on: the box is fluid up to a ceiling, so most
                            snippets end where their content ends, and a permanent fade would dim the
                            last line of every one of them to solve a problem they do not have.

                            Faded to `${surface}00` rather than `transparent`, because `transparent`
                            is transparent *black*: browsers interpolate in premultiplied sRGB and
                            the midpoint of `#272822 → transparent` is a grey haze over Monokai. The
                            same hue at zero alpha interpolates cleanly.

                            `pointer-events-none` so it never eats a click, a drag, or a text
                            selection reaching the lines underneath it. */}
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

            {/* Rendered only once it exists, so there is no empty panel to reach — `activeTab` also
                refuses to select it before then, and the two agree on purpose rather than one
                covering for the other.

                The same surface, bounds and `.markdown-preview` ramp the markdown editor's Preview
                tab uses. An explanation of a snippet and a rendered note are the same kind of thing
                on screen — prose in the drawer's content slot — and they read as one surface because
                they *are* one, not because two sets of classes were kept in step. */}
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

/** A header tab: quiet until selected, and never loud — the content below it is the point. */
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
 * The one control in the editor's chrome.
 *
 * Sized and styled as `ItemFormFields`' `SuggestButton` is — ghost, `h-7`, `text-xs`, an icon at
 * `size-3.5` — so the three AI buttons in the app are recognizably one control in three places,
 * even though this one lives in a window header rather than beside a field label.
 *
 * `MessageSquareText`, and **not** the `Sparkles` the spec asked for. Sparkles is the Prompt
 * *type's* icon in `item-type-catalog.ts`, and reusing it here was rejected once already: `e0487ed`
 * took it off the Suggest Tags button for exactly this reason. The argument for keeping it the
 * second time — that this button only ever renders on a snippet or a command, so the prompt type is
 * never on screen beside it — is true and still not enough. An icon is learned across the whole
 * app, not per surface, and one glyph meaning "prompt" in the sidebar and "explain" in a window
 * header has to be read twice wherever it appears.
 *
 * It names the *action*, which is the rule `PenLine` set for the description button — "write this
 * for me" — and the reason none of the three AI controls wears a generic AI glyph. A bubble with
 * text in it is the answer coming back, which is what this button produces: prose about the code,
 * not a transformation of it.
 *
 * **Weight is a real constraint here, not a preference.** This is the only icon in the editor's
 * chrome, and everything around it is spare — three flat dots, two quiet tabs, a mono language
 * label. `BookOpen` was tried first and rejected on sight for exactly that: a pictorial,
 * many-stroke glyph reads as heavy next to that much restraint, and at `size-3.5` its detail turns
 * to mush. The rule for replacing this icon is therefore *light and geometric before clever* — the
 * word "Explain" sits right beside it and carries the meaning, so the glyph only has to stay
 * legible and stay out of the way.
 *
 * A free account gets `Crown` and a disabled button rather than no button. It says "Explain" either
 * way — the crown is what marks it as bought, and swapping the word for "Upgrade" would make a
 * control that never says what it does.
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
            // A free account's button is inert rather than a route to the upgrade page. The action
            // behind it would refuse, and a control that navigates away from an item someone is
            // reading is a bigger surprise than one that does nothing.
            disabled={!canExplain || isExplaining}
            aria-label={label}
            title={label}
            // The hover fill is a **white alpha**, overriding the ghost variant's `bg-muted`, and
            // for the same reason `SLIDER_COLORS` above is written in white alphas: this header is
            // not painted with a theme token. It takes its colour from `EDITOR_THEME_CATALOG`, which
            // is five hard-coded monaco surfaces — `#171717`, `#272822`, `#0d1117`, `#1e1e1e`,
            // `#000000` — so a grey mixed from `--muted` lands somewhere different on each of them:
            // nearly invisible on the darkest, and washing Monokai's warm brown toward grey.
            //
            // It also has to survive light mode, which is still on the roadmap. Every monaco theme
            // here is `vs-dark`-based, so this header stays dark even when the app around it turns
            // light — at which point `--muted` flips to a *light* grey and a token-based hover would
            // vanish into the dark chrome entirely. A white alpha is immune to that by construction,
            // which is why this is not simply a contrast tweak.
            //
            // 10%, which is `scrollbarSlider.background` above to the digit — `#ffffff1a`. 15% was
            // tried first and read as too bright for chrome this quiet, and landing on the alpha the
            // scrollbar already uses means the two things that light up in this frame light up by
            // the same amount.
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
