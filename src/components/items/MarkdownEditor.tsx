"use client";

import { useState } from "react";
import { Tabs as TabsPrimitive } from "radix-ui";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";

/**
 * The panel both halves sit on. A literal, and the same one `CodeEditor` declares: the two editors
 * are the app's two content surfaces and have to look like a matched pair, which they only do if
 * they agree on the colour. `#171717` is what `--card` resolves to in dark mode.
 */
const SURFACE = "#171717";

/**
 * Shared by both tabs, so a note reads the same however it is being looked at.
 *
 * The floor and ceiling are `CodeEditor`'s, so switching an item's type does not change how much of
 * the drawer its content takes: below the floor a one-line note would be a mostly-empty box, above
 * the ceiling the panel scrolls itself rather than pushing the rest of the drawer off screen. Past
 * that ceiling is exactly when `editor-scrollbar` matters — see `globals.css`, which repaints the
 * native scrollbar in monaco's colours so the two editors do not sit side by side in a drawer with
 * different furniture.
 */
const PANEL = "editor-scrollbar min-h-[76px] max-h-[400px] overflow-y-auto";

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

    return (
        <TabsPrimitive.Root
            value={active}
            onValueChange={setTab}
            className="overflow-hidden rounded-lg border border-border aria-invalid:border-destructive"
            style={{ backgroundColor: SURFACE }}
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
                        className={cn(
                            PANEL,
                            "block w-full resize-none bg-transparent px-3 py-3 font-mono text-[13px] leading-relaxed outline-none placeholder:text-muted-foreground",
                            // Grows with what is typed, the same way the code editor follows its
                            // content height. `Textarea` in `ui/` already relies on this.
                            "field-sizing-content",
                        )}
                    />
                </TabsPrimitive.Content>
            )}

            <TabsPrimitive.Content value="preview" className={cn(PANEL, "px-3 py-3")}>
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
