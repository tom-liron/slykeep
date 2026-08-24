"use client";

import { useState, useTransition } from "react";
import { Check, ChevronDown, Folder, Lightbulb, PenLine, X } from "lucide-react";
import { toast } from "sonner";

import { generateAutoTags, generateDescription } from "@/actions/ai";
import { useIsPro } from "@/components/layout/ProContext";
import { Badge } from "@/components/ui/badge";

import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ToggleChip } from "@/components/ui/ToggleChip";
import { addTagToInput } from "@/lib/ai-tags";
// The one entitlement rule, shared with the action rather than restated — the same reason
// `SidebarNav` imports `canAccessItemType` for its PRO badge. A hand-written `isPro` check here
// would be the one gate `ENFORCE_PRO_LIMITS` could not switch off, so the button would stay hidden
// in a build where the server has stopped refusing.
import { canUseAi } from "@/lib/limits";
import { CODE_LANGUAGES, findCodeLanguage } from "@/lib/code-language";
import { cn } from "@/lib/utils";
import type { ItemDraft } from "@/types/ai";
import { CodeEditor } from "./CodeEditor";
import { MarkdownEditor } from "./MarkdownEditor";

/**
 * The fields the create dialog and the edit drawer render identically.
 *
 * Only these five. Title and URL look similar but differ in placeholder and `autoFocus`, and pulling
 * them in here would turn readable markup into prop-level configuration. There is deliberately no
 * component covering the whole field *set* either: the two forms order them differently — create
 * puts URL and the upload before the content, edit puts description before the language — so a
 * shared wrapper would have to take the order as a prop, which is worse than the duplication it
 * removes.
 *
 * **Description used to be on the other side of that line**, left inline in both forms for exactly
 * the reason above. That held while it was a labelled textarea whose only difference was a
 * placeholder, and stopped holding the moment it grew a button, an async call, a proposal to accept
 * or reject, and an entitlement check: duplicating *that* twice is the thing `TagsField` exists to
 * avoid, and the placeholder became a prop — which `ContentField` already does. Title and URL have
 * not crossed the line and stay where they are.
 *
 * Each of these owns its `<Field>` as well as its input, because the pair is the unit that has to
 * stay in step: `Field` renders the error as `<p id="{id}-error">`, and the input has to point at
 * exactly that id. Deriving the `aria-describedby` here instead of taking it from the caller's
 * `invalid()` helper is what makes the two impossible to disagree.
 */

/**
 * What all three take. A named type rather than three inline copies, because the standards prefer
 * inline props only for components whose props are *not* reused — these are the reuse.
 *
 * `id` is the caller's, not derived here, because the two forms prefix theirs differently
 * (`item-title` and `new-item-title`) so that both can be open at once without colliding.
 */
type ItemFieldProps = {
    id: string;
    value: string;
    onChange: (value: string) => void;
    error?: string;
};

/** Points a rejected input at the message `Field` renders for it. */
function invalidProps(id: string, error?: string) {
    return error ? { "aria-invalid": true, "aria-describedby": `${id}-error` } : undefined;
}

/**
 * What a field hands to `Field`'s `action` slot to ask the model for something.
 *
 * Shared by the tags and description fields so the two cannot drift on size, spacing, or what
 * "working" looks like — they sit a few pixels apart in the same form, and two ghost buttons that
 * pulse differently would read as two features rather than one.
 *
 * **Both carry visible text**, which the description button did not at first. An icon alone is a
 * question mark on a control that spends the user's money and their rate limit, and a tooltip is no
 * answer on a touch screen, where nothing hovers.
 *
 * `pendingText` is a prop rather than one shared "Suggesting…" because the verb has to match the
 * button: the tags button suggests and the description button writes, and a control that changes
 * what it claims to be doing while it does it is worse than one that says nothing.
 *
 * `label` is the accessible name and the tooltip — a longer phrase naming *how*, which the visible
 * text has no room for. It must **contain** that visible text: WCAG 2.5.3 (Label in Name) is what
 * makes "click Describe" work for someone driving the app by voice, and an `aria-label` that
 * replaces the word on the button rather than extending it is what breaks it.
 */
function SuggestButton({
    icon: Icon,
    label,
    text,
    pendingText,
    isPending,
    onClick,
}: {
    icon: typeof Lightbulb;
    label: string;
    text: string;
    pendingText: string;
    isPending: boolean;
    onClick: () => void;
}) {
    return (
        <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClick}
            disabled={isPending}
            aria-label={label}
            title={label}
            className="-my-1 h-7 gap-1.5 px-2 text-xs"
        >
            <Icon className={cn("size-3.5", isPending && "animate-pulse")} aria-hidden="true" />
            <span>{isPending ? pendingText : text}</span>
        </Button>
    );
}

/**
 * The description an item gets when nobody wants to write one.
 *
 * The button is `PenLine` — "write this for me", which is the action. Deliberately not `Sparkles`,
 * the Prompt type's icon in `item-type-catalog.ts`, and deliberately not `Lightbulb`, which is the
 * tag button eight pixels below it; two AI controls in one form have to be told apart at a glance.
 *
 * It says **"Describe"**, not "Suggest Description". Symmetry with the tags button was the obvious
 * reading and the wrong one: you do not *suggest* a description, you write one, and the phrase is
 * the longest option on the row that has least room for it. "Summarize" was the other candidate and
 * promises something else — a summary condenses what the reader is also going to read, a
 * description says what the item is so they do not have to — besides colliding with the standalone
 * summary feature still open in `docs/ai-integration-plan.md` §14. One imperative verb carrying its
 * own object is what lets it sit beside a label that already says "Description" without restating
 * it, which is the thing "Suggest Tags" has to do because "Suggest" alone says nothing.
 *
 * **Where the answer lands is one rule with two shapes: never destroy text the user wrote.** An
 * empty field is filled directly, because filling nothing destroys nothing and the extra click
 * would be a review of a decision already made. A field with something in it gets a proposal
 * underneath, accepted or dismissed the way a suggested tag is — the same two controls, in the same
 * two colours, for the same reason.
 */
export function DescriptionField({
    id,
    value,
    onChange,
    error,
    placeholder,
    draft,
}: ItemFieldProps & {
    placeholder?: string;
    /** Omit to render the plain field — the button appears only when there is something to send. */
    draft?: () => ItemDraft;
}) {
    // What is shown, not what is enforced: `generateDescription` runs this same check server-side,
    // so a free account that reaches the action by hand is still refused. This only keeps a control
    // that would always fail off their screen.
    const canSuggest = canUseAi(useIsPro());
    const [proposal, setProposal] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    const suggest = () => {
        startTransition(async () => {
            const result = await generateDescription(draft!());

            if (!result.success) {
                toast.error(result.error);

                return;
            }

            if (value.trim() === "") {
                onChange(result.data.description);
                setProposal(null);

                return;
            }

            // Replaces any proposal already on screen rather than stacking a second one, so what is
            // shown always answers the most recent question.
            setProposal(result.data.description);
        });
    };

    const accept = () => {
        onChange(proposal!);
        setProposal(null);
    };

    return (
        <Field
            id={id}
            label="Description"
            error={error}
            action={
                canSuggest && draft ? (
                    <SuggestButton
                        icon={PenLine}
                        label="Describe this item with AI"
                        text="Describe"
                        pendingText="Writing…"
                        isPending={isPending}
                        onClick={suggest}
                    />
                ) : undefined
            }
        >
            <Textarea
                id={id}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder={placeholder}
                rows={2}
                {...invalidProps(id, error)}
            />

            {proposal && (
                /* A block rather than the tags' inline badge, because the content is a sentence:
                   badges wrap by word and would break it across lines with the controls stranded at
                   the end. The colours are the tag suggestions' exactly — blue for a proposal that
                   is not yet the field's value, green and red for two opposite actions that would
                   otherwise be a pair of identical grey glyphs. */
                <div className="flex items-start gap-1 rounded-md border bg-muted/40 p-2">
                    <p className="flex-1 text-xs leading-relaxed text-suggestion">{proposal}</p>

                    <button
                        type="button"
                        onClick={accept}
                        aria-label="Use this description"
                        className="rounded-full p-0.5 text-confirm transition-colors hover:bg-confirm/15"
                    >
                        <Check className="size-3.5" aria-hidden="true" />
                    </button>

                    <button
                        type="button"
                        onClick={() => setProposal(null)}
                        aria-label="Dismiss this description"
                        className="rounded-full p-0.5 text-destructive transition-colors hover:bg-destructive/15"
                    >
                        <X className="size-3.5" aria-hidden="true" />
                    </button>
                </div>
            )}
        </Field>
    );
}

/**
 * An item's body, in whichever editor its type calls for.
 *
 * `isCode` is the caller's `itemTypeOwns(...).language` — "this type's content is code" and "this
 * type has a language worth declaring" are the same question, which is why one flag answers both
 * here and in the drawer. An item is therefore never edited in one editor and displayed in the
 * other. The language is live: retyping it re-highlights as you go.
 */
export function ContentField({
    id,
    value,
    onChange,
    language,
    isCode,
    error,
    placeholder,
}: ItemFieldProps & { language: string; isCode: boolean; placeholder?: string }) {
    const invalid = invalidProps(id, error);

    return (
        <Field id={id} label="Content" error={error}>
            {isCode ? (
                <CodeEditor
                    id={id}
                    label="Content"
                    value={value}
                    language={language}
                    onChange={onChange}
                    placeholder={placeholder}
                    {...invalid}
                />
            ) : (
                <MarkdownEditor
                    id={id}
                    label="Content"
                    value={value}
                    onChange={onChange}
                    placeholder={placeholder}
                    {...invalid}
                />
            )}
        </Field>
    );
}

/**
 * What the picker calls an undeclared language.
 *
 * "Plain text" rather than "None", and the two are not interchangeable: `CodeEditor`'s header names
 * the same state a few pixels below this control, in the same form, on the same item — as `text`. A
 * control saying "None" over an editor saying `text` is the app disagreeing with itself. It also
 * names the *outcome* (no highlighting) where "None" names an absence and leaves the reader to work
 * out what that does.
 *
 * The two spellings differ deliberately — see `codeLanguageLabel`. This is a form control and gets a
 * readable phrase; the header is a monospace title bar and gets a token.
 *
 * The **label** changed; the **value** did not. This option still writes an empty string, which
 * `blankToNull` in `item-schemas.ts` stores as `null`. Writing the literal `"plaintext"` instead
 * would be the tidier-looking version and would put a `plaintext` badge on every unlabelled snippet,
 * since `ItemDrawer` renders a badge for any truthy `language` — an absence announced as a fact.
 */
const PLAIN_TEXT_LABEL = "Plain text";

/**
 * The language the content is highlighted as.
 *
 * Rendered above the content in both forms, deliberately: it is what the editor highlights by, so
 * asking for it after the code has been written is asking too late.
 *
 * A dropdown rather than the free-text input this used to be, copying `PreferenceSelect` in
 * `settings/EditorPreferencesRows.tsx` — the codebase's existing "pick one of a list" control,
 * already styled and keyboard-navigable. Radix gives the menu typeahead over the item labels, which
 * is what keeps a thirty-item list usable without reaching for a searchable combobox.
 *
 * What it writes is a monaco language id, so the stored value needs no alias lookup to highlight.
 * What it *reads* may be anything, because items predate the list: `findCodeLanguage` resolves
 * aliases first so an item stored as `TS` shows TypeScript, and a value that still matches nothing
 * is rendered as its own option rather than dropped. Nothing is rewritten by opening a form —
 * `onChange` only fires on a real choice — so an item keeps the language it has until someone
 * changes it.
 */
export function LanguageField({ id, value, onChange, error }: ItemFieldProps) {
    const matched = findCodeLanguage(value);

    // A language this list does not offer, kept so the picker cannot silently discard it. Empty is
    // not this case: an undeclared language is the "Plain text" option, which every item can reach.
    const unlisted = !matched && value.trim() ? value.trim() : null;

    const selected = matched?.value ?? unlisted ?? "";

    return (
        <Field id={id} label="Language" error={error}>
            <DropdownMenu>
                {/* `Field`'s label points at this id, and a button is a labelable element, so the
                    pair behaves the way the other fields' label/input pairs do. */}
                <DropdownMenuTrigger asChild>
                    <Button
                        id={id}
                        variant="outline"
                        className="w-full justify-between font-normal"
                        {...invalidProps(id, error)}
                    >
                        <span className={selected ? undefined : "text-muted-foreground"}>
                            {matched?.label ?? unlisted ?? PLAIN_TEXT_LABEL}
                        </span>
                        <ChevronDown data-icon="inline-end" aria-hidden="true" />
                    </Button>
                </DropdownMenuTrigger>

                {/* Matched to the trigger's width so it reads as one control with the fields above
                    and below it, and capped in height because the list is long enough to scroll. */}
                <DropdownMenuContent
                    align="start"
                    className="max-h-72 w-[var(--radix-dropdown-menu-trigger-width)] overflow-y-auto"
                >
                    <DropdownMenuRadioGroup value={selected} onValueChange={onChange}>
                        <DropdownMenuRadioItem value="">{PLAIN_TEXT_LABEL}</DropdownMenuRadioItem>

                        {unlisted && (
                            <DropdownMenuRadioItem value={unlisted}>
                                {unlisted}
                            </DropdownMenuRadioItem>
                        )}

                        {CODE_LANGUAGES.map((language) => (
                            <DropdownMenuRadioItem key={language.value} value={language.value}>
                                {language.label}
                            </DropdownMenuRadioItem>
                        ))}
                    </DropdownMenuRadioGroup>
                </DropdownMenuContent>
            </DropdownMenu>
        </Field>
    );
}

/**
 * The comma-separated tag input, and the AI suggestions beside it.
 *
 * One string here, split on submit and normalized by the schema — trimming, dropping blanks, and
 * de-duplicating happen in the one place that also has to reject a bad payload.
 *
 * The suggestions live in this component rather than in either form, which is the whole reason both
 * forms get the feature from one implementation: `TagsField` is already the field they share. What
 * they pass is `draft` — the title and body *as typed right now*, not as stored — since the create
 * dialog has no saved item to read and the edit form's inputs have moved on from the one it does
 * have. A form that passes no `draft` simply renders the field as it always did.
 */
export function TagsField({
    id,
    value,
    onChange,
    error,
    draft,
}: ItemFieldProps & {
    /** Omit to render the plain field — the button appears only when there is something to send. */
    draft?: () => ItemDraft;
}) {
    // What is shown, not what is enforced: `generateAutoTags` runs this same check server-side, so
    // a free account that reaches the action by hand is still refused. This only keeps a control
    // that would always fail off their screen.
    const canSuggest = canUseAi(useIsPro());
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [isPending, startTransition] = useTransition();

    const suggest = () => {
        startTransition(async () => {
            const result = await generateAutoTags(draft!());

            if (!result.success) {
                toast.error(result.error);

                return;
            }

            // Anything already in the field is dropped from the list rather than offered again —
            // accepting it would be a no-op, and a badge that does nothing when clicked reads as
            // broken. Re-running the suggestion replaces the previous list rather than adding to
            // it, so what is on screen always answers the most recent question.
            const held = value.split(",").map((entry) => entry.trim().toLowerCase());

            setSuggestions(result.data.tags.filter((tag) => !held.includes(tag)));
        });
    };

    const accept = (tag: string) => {
        onChange(addTagToInput(value, tag));
        dismiss(tag);
    };

    const dismiss = (tag: string) =>
        setSuggestions((current) => current.filter((entry) => entry !== tag));

    return (
        <Field
            id={id}
            label="Tags"
            error={error}
            hint="Separate tags with commas."
            action={
                canSuggest && draft ? (
                    /* Deliberately not `Sparkles`, which the spec asked for: that is the Prompt
                       type's icon in `item-type-catalog.ts`, so the button and a prompt item
                       rendered the same glyph a few pixels apart. `Wand`/`WandSparkles` are the
                       usual "generate this for me" mark and were the obvious swap, but both are
                       built from eight or nine paths *and* carry their own sparkle cluster —
                       illegible at 14px and still the thing being avoided. A lightbulb is three
                       paths, reads cleanly at this size, means "suggestion" rather than "magic",
                       and collides with nothing else in the app. */
                    <SuggestButton
                        icon={Lightbulb}
                        label="Suggest Tags with AI"
                        text="Suggest Tags"
                        pendingText="Suggesting…"
                        isPending={isPending}
                        onClick={suggest}
                    />
                ) : undefined
            }
        >
            <Input
                id={id}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder="e.g. react, hooks"
                {...invalidProps(id, error)}
            />

            {suggestions.length > 0 && (
                /* Each suggestion is a badge with its own accept and reject, rather than one
                   "apply all" — the model is right about most of a list and wrong about one of it,
                   and per-tag controls are what make that the two clicks it should be. The tag text
                   is not itself a button: two adjacent targets doing different things is enough
                   without a third that duplicates one of them. */
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    <span className="text-xs text-muted-foreground">Suggested:</span>

                    {suggestions.map((tag) => (
                        /* Three colours, and each one is doing a job. The tag is blue because it
                           is not yet a tag — it is a proposal, and it should not read as the
                           settled text in the input above it. The two controls are green and red
                           because accept and reject are opposites, and a pair of identical grey
                           glyphs makes the user read the icon every time to tell which is which. */
                        <Badge
                            key={tag}
                            variant="outline"
                            className="gap-0.5 pr-0.5 pl-2 text-suggestion"
                        >
                            {tag}

                            <button
                                type="button"
                                onClick={() => accept(tag)}
                                aria-label={`Add tag ${tag}`}
                                className="rounded-full p-0.5 text-confirm transition-colors hover:bg-confirm/15"
                            >
                                <Check className="size-3" aria-hidden="true" />
                            </button>

                            <button
                                type="button"
                                onClick={() => dismiss(tag)}
                                aria-label={`Dismiss tag ${tag}`}
                                className="rounded-full p-0.5 text-destructive transition-colors hover:bg-destructive/15"
                            >
                                <X className="size-3" aria-hidden="true" />
                            </button>
                        </Badge>
                    ))}
                </div>
            )}
        </Field>
    );
}

/**
 * Which collections the item belongs to — any number of them, including none.
 *
 * Checkboxes rather than a `<select multiple>` or a combobox: an item can be in many collections at
 * once, and a multi-select hides that behind a control most people only ever pick one option from.
 * They are styled as the chips the type selector uses, so "pick several" reads the same in both item
 * forms. The real `<input type="checkbox">` is kept and only visually hidden, which is what keeps
 * the keyboard and screen-reader behaviour the browser already gives this for free.
 *
 * This is the one field here that does not use `Field`. `Field` renders a `<label htmlFor>`, and a
 * group of checkboxes has no single input for a label to point at — the correct markup is a
 * `<fieldset>` with a `<legend>`, so it restates `Field`'s three lines rather than mislabelling
 * itself. `aria-describedby` on the group is what ties the error to it.
 *
 * The options are the caller's, not fetched here: only the caller knows whether they arrived, and
 * that decides whether the form may submit a membership list at all. Sending an empty one when the
 * list simply failed to load would read as "remove this item from everything".
 */
export function CollectionsField({
    id,
    options,
    selectedIds,
    onChange,
    isLoading,
    failed,
    error,
}: {
    id: string;
    options: readonly { id: string; name: string }[];
    selectedIds: readonly string[];
    onChange: (ids: string[]) => void;
    isLoading: boolean;
    failed: boolean;
    error?: string;
}) {
    const toggle = (collectionId: string) =>
        onChange(
            selectedIds.includes(collectionId)
                ? selectedIds.filter((id) => id !== collectionId)
                : [...selectedIds, collectionId],
        );

    return (
        <fieldset
            className="space-y-1.5"
            // On the group rather than on any one checkbox: the message is about the selection, and
            // there is no single input for it to belong to.
            aria-describedby={error ? `${id}-error` : undefined}
        >
            <legend className="text-xs font-medium text-muted-foreground">Collections</legend>

            {isLoading ? (
                <div className="h-8 animate-pulse rounded-md bg-muted" />
            ) : failed ? (
                <p className="text-sm text-muted-foreground">
                    Collections could not be loaded. Saving leaves this item&apos;s collections as
                    they are.
                </p>
            ) : options.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                    No collections yet — create one from the top bar.
                </p>
            ) : (
                // Grows to fit, deliberately uncapped. A `max-h` here gives the list its own
                // scrollbar *inside* a panel that already has one — two nested scrollbars for one
                // field, with the outer one no longer reaching the content the inner one hides.
                // Both callers already scroll (the drawer's sheet, and the dialog's `max-h-[60vh]`),
                // so letting this be as tall as it needs to be is what keeps there being one.
                <div className="flex flex-wrap gap-2 pt-1.5">
                    {options.map((collection) => {
                        const selected = selectedIds.includes(collection.id);

                        return (
                            <ToggleChip
                                key={collection.id}
                                type="checkbox"
                                name={id}
                                value={collection.id}
                                checked={selected}
                                onChange={() => toggle(collection.id)}
                                className={selected ? "border-primary bg-primary/10" : undefined}
                            >
                                {selected ? (
                                    <Check className="size-3.5 shrink-0" aria-hidden="true" />
                                ) : (
                                    <Folder className="size-3.5 shrink-0" aria-hidden="true" />
                                )}
                                <span className="truncate">{collection.name}</span>
                            </ToggleChip>
                        );
                    })}
                </div>
            )}

            {error && (
                <p id={`${id}-error`} className="text-sm text-destructive">
                    {error}
                </p>
            )}
        </fieldset>
    );
}
