"use client";

import { useState } from "react";
import { Tabs as TabsPrimitive } from "radix-ui";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { useEditorPreferences } from "@/components/settings/EditorPreferencesContext";
import { EDITOR_MAX_HEIGHT, EDITOR_MIN_HEIGHT, EDITOR_THEME_CATALOG } from "@/config/editor";
import { cn } from "@/lib/utils";

/** Shared by both tabs, so a note reads the same however it is being looked at. */
const PANEL = "app-scrollbar overflow-y-auto";

/**
 * The floor and ceiling are `CodeEditor`'s, so switching an item's type does not change how much of
 * the drawer its content takes. Inline rather than Tailwind's `min-h-[76px]`, because the value now
 * comes from a module and Tailwind cannot generate a class from one — the documented exception in
 * `coding-standards.md`, and the same reason it stops being a number written twice.
 */
const PANEL_BOUNDS = { minHeight: EDITOR_MIN_HEIGHT, maxHeight: EDITOR_MAX_HEIGHT };

/**
 * A markdown editor for the item types whose content is prose — notes and prompts.
 *
 * Two tabs over one value: Write is a plain textarea, Preview is that text rendered. The split is
 * deliberate rather than a live side-by-side pane — the drawer is narrow, and half of it is not
 * enough width for either half to be worth reading.
 *
 * It is used in both directions, exactly as `CodeEditor` is: read-only in the drawer, where it
 * replaces the `<pre>`, and editable in the create and edit forms. Read-only has nothing to write,
 * so it shows the Preview tab alone; editing opens on Write, because arriving at a form on a
 * rendered view of what you came to change is a click wasted every time.
 *
 * Raw HTML in the source is escaped, not rendered. That is `react-markdown`'s default and it stays
 * that way — content is user-authored and read back by its own author, but a stored note is still
 * untrusted input, and `rehype-raw` would turn one into a script tag.
 */
export function MarkdownEditor({
    value,
    readOnly = false,
    onChange,
    id,
    label,
    placeholder,
    "aria-invalid": ariaInvalid,
    "aria-describedby": ariaDescribedBy,
}: {
    value: string;
    readOnly?: boolean;
    onChange?: (value: string) => void;
    /** The textarea's, so the `Field` label above it points at something real. */
    id?: string;
    /** Names the editor for assistive tech, since the visible label is outside the component. */
    label: string;
    placeholder?: string;
    "aria-invalid"?: boolean;
    "aria-describedby"?: string;
}) {
    const [tab, setTab] = useState("write");

    // Read-only pins the value rather than seeding the state, so a component that mounts editable
    // and is later made read-only cannot be left showing a textarea it will not accept input into.
    const active = readOnly ? "preview" : tab;

    // The three preferences that mean something for prose. The minimap and the theme's token colours
    // are monaco's alone — there is no syntax to colour here and nothing to overview — but the
    // theme's *surface* still applies, or a note would sit on a different panel from a snippet the
    // moment the theme changed. Same fallback as `CodeEditor` when no provider is mounted.
    const preferences = useEditorPreferences();
    const surface = EDITOR_THEME_CATALOG[preferences.theme].surface;

    return (
        <TabsPrimitive.Root
            value={active}
            onValueChange={setTab}
            className="overflow-hidden rounded-lg border border-border aria-invalid:border-destructive"
            style={{ backgroundColor: surface }}
            aria-invalid={ariaInvalid}
            aria-describedby={ariaDescribedBy}
        >
            <div className="flex items-center gap-2 border-b border-border px-2 py-1.5">
                <TabsPrimitive.List className="flex items-center gap-1" aria-label={label}>
                    {!readOnly && <Tab value="write">Write</Tab>}
                    <Tab value="preview">Preview</Tab>
                </TabsPrimitive.List>

                {/* Mirrors the language `CodeEditor` prints in the same corner: what the panel below
                    will do with the text, stated before it is written rather than discovered. */}
                <span className="ml-auto pr-1 font-mono text-[11px] text-muted-foreground">
                    markdown
                </span>
            </div>

            {/* Kept mounted so the caret and scroll position survive a look at the preview, and so
                the `Field` label's `htmlFor` still resolves while the other tab is showing. Radix
                leaves a force-mounted panel visible, so hiding it is this class's job. */}
            {!readOnly && (
                <TabsPrimitive.Content
                    value="write"
                    forceMount
                    className="data-[state=inactive]:hidden"
                >
                    <textarea
                        id={id}
                        value={value}
                        onChange={(event) => onChange?.(event.target.value)}
                        placeholder={placeholder}
                        aria-label={label}
                        spellCheck={false}
                        // The native way to stop soft wrapping; monaco's `wordWrap: "off"` reaches
                        // the same place from the other side. Both then scroll sideways instead.
                        wrap={preferences.wordWrap ? "soft" : "off"}
                        // `fontSize` replaces the `text-[13px]` this used to carry, and `tabSize` is
                        // what a literal tab in a note is rendered as — the same two numbers monaco
                        // is given, so a snippet and a note are set in the same type.
                        style={{
                            ...PANEL_BOUNDS,
                            fontSize: preferences.fontSize,
                            tabSize: preferences.tabSize,
                        }}
                        className={cn(
                            PANEL,
                            "block w-full resize-none bg-transparent px-3 py-3 font-mono leading-relaxed outline-none placeholder:text-muted-foreground",
                            // Grows with what is typed, the same way the code editor follows its
                            // content height. `Textarea` in `ui/` already relies on this.
                            "field-sizing-content",
                        )}
                    />
                </TabsPrimitive.Content>
            )}

            {/* Preview keeps `.markdown-preview`'s own type ramp rather than following the font-size
                preference. That ramp is 20/16/14/13 in `rem` against a 14px body, deliberately — see
                `globals.css` — so scaling it would mean converting the whole thing to `em` and
                re-tuning the margins that were fixed in `rem` for exactly that reason. The
                preference is about the source you write; this half is rendered prose. */}
            <TabsPrimitive.Content
                value="preview"
                style={PANEL_BOUNDS}
                className={cn(PANEL, "px-3 py-3")}
            >
                {value.trim() ? (
                    <div className="markdown-preview">
                        {/* Fenced code is not syntax highlighted, deliberately. `rehype-highlight`
                            was tried and reverted: it registers 37 languages and put 352K of
                            highlight.js into the chunk that every item drawer loads, to colour the
                            occasional command in a note. `react-markdown` still emits the fence's
                            `language-*` class, so a highlighter can be dropped in later without
                            touching anything here — see the note in `globals.css` about the option
                            that does not need a dependency at all. */}
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>
                    </div>
                ) : (
                    <p className="text-sm text-muted-foreground">Nothing to preview.</p>
                )}
            </TabsPrimitive.Content>
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
