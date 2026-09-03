"use client";

import { useState, useTransition } from "react";
import { Check, Crown, Loader2, Sparkles, X } from "lucide-react";
import { Tabs as TabsPrimitive } from "radix-ui";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

import { optimizePrompt } from "@/actions/ai";
import { useIsPro } from "@/components/layout/ProContext";
import { useEditorPreferences } from "@/components/settings/EditorPreferencesContext";
import { Button } from "@/components/ui/button";
import { EDITOR_THEME_CATALOG } from "@/config/editor";
import { canUseAi } from "@/lib/limits";
import { MARKDOWN_PLUGINS } from "@/lib/markdown-plugins";
import { cn } from "@/lib/utils";
import type { ItemDraft } from "@/types/ai";
import { ContentTextarea, EDITOR_PANEL, EDITOR_PANEL_BOUNDS } from "./ContentTextarea";

/**
 * The tabbed markdown editor for the item types whose content is prose — notes and prompts.
 *
 * Two tabs over one value: Write is `ContentTextarea`, Preview is that text rendered with
 * `MARKDOWN_PLUGINS`. Used in both directions like `CodeEditor`: read-only in the drawer (Preview
 * only, replacing a `<pre>`), and editable in the create and edit forms (opening on Write). When
 * the `optimize` prop is passed — only by the drawer, for prompts — it also runs the AI prompt
 * optimizer and shows the rewrite as a third tab.
 *
 * The panel class and height bounds come from `ContentTextarea`, shared with `CodeEditor`, so an
 * item's content takes the same amount of the drawer whatever its type.
 *
 * @remarks
 * Raw HTML in the source is escaped, not rendered — `react-markdown`'s default. A stored note is
 * untrusted input, and `rehype-raw` would turn one into a script tag.
 */
export function MarkdownEditor({
    value,
    readOnly = false,
    onChange,
    id,
    label,
    placeholder,
    optimize,
    onUseOptimized,
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
    /**
     * What to send the model when Optimize is clicked. **Omit it and the whole feature is absent** —
     * no button, no tabs, no action import reached at runtime — which is how every markdown editor
     * outside the drawer stays exactly as it was. The same opt-in shape `CodeEditor`'s `explain`
     * prop uses, and for the same reason.
     *
     * A function rather than an `ItemDraft` value, so the request describes what is on screen now
     * rather than what was on screen when this rendered.
     */
    optimize?: () => ItemDraft;
    /**
     * Accepts the rewrite. Resolves `true` when it was saved, which is what tells this component to
     * put the review away — a failed save has to leave the panel open, or the rewrite the user
     * wanted is gone with nothing to retry from.
     *
     * The save itself is the caller's: the drawer knows the item id and the rest of the payload
     * the write carries.
     */
    onUseOptimized?: (prompt: string) => Promise<boolean>;
    "aria-invalid"?: boolean;
    "aria-describedby"?: string;
}) {
    const [tab, setTab] = useState("write");
    /** The rewrite this editor has been offered, or null while it has none. */
    const [optimized, setOptimized] = useState<{ prompt: string; changes: string[] } | null>(null);
    const [isOptimizing, startOptimizing] = useTransition();
    const [isAccepting, startAccepting] = useTransition();

    // Read-only pins the value rather than seeding the state, so a component that mounts editable
    // and is later made read-only cannot be left showing a textarea it will not accept input into.
    // The optimized panel is pinned the same way in the other direction: it can only be showing
    // while there is a rewrite to show, so nothing can leave this editor on an empty tab.
    const home = readOnly ? "preview" : "write";
    const active =
        tab === "optimized"
            ? optimized === null
                ? home
                : "optimized"
            : readOnly
              ? "preview"
              : tab;

    // Controls appearance, not access: `optimizePrompt` re-checks entitlement and item type
    // server-side. A free account still sees the button, disabled with a crown, so the feature is
    // discoverable — the same choice `ExplainButton` makes.
    const canOptimize = canUseAi(useIsPro());

    const requestOptimization = () => {
        startOptimizing(async () => {
            const result = await optimizePrompt(optimize!());

            if (!result.success) {
                toast.error(result.error);

                return;
            }

            // A prompt the model had nothing to change is a valid result: report it and stop,
            // rather than open a review of a rewrite identical to the original.
            if (result.data.unchanged) {
                toast.success("This prompt already reads well. Nothing to change.");

                return;
            }

            setOptimized({ prompt: result.data.prompt, changes: result.data.changes });
            // Switches on arrival rather than waiting to be clicked, as the explain tab does: the
            // user asked for a rewrite and this is it.
            setTab("optimized");
        });
    };

    const useOptimized = () => {
        startAccepting(async () => {
            if (await onUseOptimized!(optimized!.prompt)) {
                // Only on a successful save. The `value` prop is the new body by now, so dropping
                // the review returns the reader to their own prompt — the optimized one.
                setOptimized(null);
                setTab(home);
            }
        });
    };

    const discardOptimized = () => {
        setOptimized(null);
        setTab(home);
    };

    // Only the theme's surface colour is read here — the font and wrap preferences live in
    // `ContentTextarea`, and there is no syntax to colour. The surface still applies so a note and
    // a snippet share one panel colour under any theme. Falls back like `CodeEditor` with no
    // provider mounted.
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
            {/* `flex-wrap`, for the reason recorded in `CodeEditor`: this row is inside an
                `overflow-hidden` box, so it clips rather than scrolls. Three tabs — Write,
                Original, Optimized — plus the optimize button and the format label need more room
                than the drawer has on a narrow phone. */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 border-b border-border px-2 py-1.5">
                <TabsPrimitive.List className="flex items-center gap-1" aria-label={label}>
                    {!readOnly && <Tab value="write">Write</Tab>}
                    {/* "Preview" until there is a rewrite to hold it against, then "Original" — the
                        same reason `CodeEditor` shows no tabs until its explanation exists. */}
                    <Tab value="preview">{optimized ? "Original" : "Preview"}</Tab>
                    {optimized && <Tab value="optimized">Optimized</Tab>}
                </TabsPrimitive.List>

                <div className="ml-auto flex items-center gap-2">
                    {optimize && (
                        <OptimizeButton
                            canOptimize={canOptimize}
                            isOptimizing={isOptimizing}
                            hasOptimized={optimized !== null}
                            onClick={requestOptimization}
                        />
                    )}

                    {/* Mirrors the language `CodeEditor` prints in the same corner: what the panel
                        below will do with the text, stated before it is written rather than
                        discovered. */}
                    <span className="pr-1 font-mono text-[11px] text-muted-foreground">
                        markdown
                    </span>
                </div>
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
                    <ContentTextarea
                        id={id}
                        value={value}
                        onChange={onChange}
                        placeholder={placeholder}
                        label={label}
                    />
                </TabsPrimitive.Content>
            )}

            {/* Preview keeps `.markdown-preview`'s own type ramp (see `globals.css`) rather than
                the font-size preference: the preference sizes the source you write, and this half
                is rendered prose. */}
            <TabsPrimitive.Content
                value="preview"
                style={EDITOR_PANEL_BOUNDS}
                className={cn(EDITOR_PANEL, "px-3 py-3")}
            >
                {value.trim() ? (
                    <div className="markdown-preview">
                        {/* Fenced code is not syntax highlighted: a highlighter that every item
                            drawer loads is a large chunk for the occasional command in a note.
                            `react-markdown` still emits the fence's `language-*` class, so one can
                            be added later — see `globals.css`. */}
                        <ReactMarkdown remarkPlugins={MARKDOWN_PLUGINS}>{value}</ReactMarkdown>
                    </div>
                ) : (
                    <p className="text-sm text-muted-foreground">Nothing to preview.</p>
                )}
            </TabsPrimitive.Content>

            {/* Not force-mounted, unlike Write. There is nothing here to preserve across a tab
                switch — no caret, no scroll position worth keeping, and no label pointing into it —
                and the panel only exists while `optimized` does, so mounting it is the same
                condition as rendering it. */}
            {optimized && (
                <TabsPrimitive.Content
                    value="optimized"
                    style={EDITOR_PANEL_BOUNDS}
                    className={cn(EDITOR_PANEL, "space-y-4 px-3 py-3")}
                >
                    {/* Rendered, not raw, so the two tabs show the prompt the same way and the
                        comparison is like for like. */}
                    <div className="markdown-preview">
                        <ReactMarkdown remarkPlugins={MARKDOWN_PLUGINS}>
                            {optimized.prompt}
                        </ReactMarkdown>
                    </div>

                    {/* The account of what changed, so accepting is an informed choice
                        (`docs/ai-integration-plan.md` §4). Hidden when the model listed nothing —
                        the two tabs still compare by eye. */}
                    {optimized.changes.length > 0 && (
                        <div className="space-y-1.5 border-t border-border/60 pt-3">
                            <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                                What changed
                            </p>
                            <ul className="list-inside list-disc space-y-1 text-xs text-muted-foreground">
                                {optimized.changes.map((change) => (
                                    <li key={change}>{change}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Only when `onUseOptimized` is passed — without it the panel is still
                        readable and copyable, but there is nowhere to accept the rewrite into. */}
                    {onUseOptimized && (
                        <div className="flex items-center gap-2 border-t border-border/60 pt-3">
                            <Button
                                type="button"
                                size="sm"
                                onClick={useOptimized}
                                disabled={isAccepting}
                                className="h-7 gap-1.5 bg-emerald-600 px-2.5 text-xs text-white hover:bg-emerald-500"
                            >
                                {isAccepting ? (
                                    <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                                ) : (
                                    <Check className="size-3.5" aria-hidden="true" />
                                )}
                                <span>{isAccepting ? "Saving…" : "Use This"}</span>
                            </Button>

                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={discardOptimized}
                                disabled={isAccepting}
                                className="h-7 gap-1.5 px-2.5 text-xs hover:bg-white/10 dark:hover:bg-white/10"
                            >
                                <X className="size-3.5" aria-hidden="true" />
                                <span>Discard</span>
                            </Button>

                            {/* Says what the green button will do before it does it. The rewrite
                                replaces saved content, which is not a change to discover after the
                                fact. */}
                            <span className="pl-1 text-[11px] text-muted-foreground">
                                Replaces the saved prompt
                            </span>
                        </div>
                    )}
                </TabsPrimitive.Content>
            )}
        </TabsPrimitive.Root>
    );
}

/**
 * The Optimize control in the editor's chrome, shown only when `MarkdownEditor` has an `optimize`
 * prop.
 *
 * `Sparkles` because this transforms the content, and sparkles is this app's mark for generative
 * transformation (`SuggestButton` for tags, the item-type catalog for prompts). `ExplainButton`
 * writes *about* the content, so it uses a different glyph.
 *
 * A free account gets `Crown` and a disabled button, keeping the word "Optimize" — the same choice
 * `ExplainButton` makes, so the control still says what it does.
 */
function OptimizeButton({
    canOptimize,
    isOptimizing,
    hasOptimized,
    onClick,
}: {
    canOptimize: boolean;
    isOptimizing: boolean;
    hasOptimized: boolean;
    onClick: () => void;
}) {
    // Native `title` rather than a tooltip component, which this app does not have — the same thing
    // `ExplainButton` and `SuggestButton` do. `aria-label` carries it for assistive tech, since a
    // `title` alone is not reliably announced.
    const label = canOptimize
        ? hasOptimized
            ? "Optimize this prompt with AI again"
            : "Optimize this prompt with AI"
        : "AI features require Pro subscription";

    return (
        <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClick}
            // Inert for a free account, not a link to the upgrade page — see `ExplainButton`:
            // navigating away from an item someone is reading is the bigger surprise.
            disabled={!canOptimize || isOptimizing}
            aria-label={label}
            title={label}
            // A white alpha, not `bg-muted`: this header's colour comes from
            // `EDITOR_THEME_CATALOG`'s fixed monaco surfaces, not a theme token, so a `--muted`
            // grey would land differently on each and vanish under light mode. Matched digit for
            // digit to `ExplainButton`'s className so the two editors' AI buttons light up alike.
            className="-my-1 h-7 gap-1.5 px-2 text-xs hover:bg-white/10 dark:hover:bg-white/10"
        >
            {!canOptimize ? (
                <Crown className="size-3.5" aria-hidden="true" />
            ) : isOptimizing ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            ) : (
                <Sparkles className="size-3.5" aria-hidden="true" />
            )}
            <span>{isOptimizing ? "Optimizing…" : "Optimize"}</span>
        </Button>
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
