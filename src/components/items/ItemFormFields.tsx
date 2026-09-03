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
import { Field, invalidProps } from "@/components/ui/Field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ToggleChip } from "@/components/ui/ToggleChip";
import { addTagToInput } from "@/lib/ai-tags";
// The entitlement rule shared with the AI actions, not restated here, so the button's visibility
// tracks `ENFORCE_PRO_LIMITS` the same way the server's refusal does — the same reason
// `SidebarNav` imports `canAccessItemType` for its PRO badge.
import { canUseAi } from "@/lib/limits";
import { CODE_LANGUAGES, findCodeLanguage } from "@/lib/code-language";
import { cn } from "@/lib/utils";
import type { ItemDraft } from "@/types/ai";
import { CodeEditor } from "./CodeEditor";
import { MarkdownEditor } from "./MarkdownEditor";

/**
 * The item fields that carry enough behaviour to be worth sharing between the create dialog and the
 * edit drawer: {@link DescriptionField}, {@link ContentField}, {@link LanguageField},
 * {@link TagsField}, {@link CollectionsField}.
 *
 * Each owns its `<Field>` wrapper as well as its input, so the two stay in step: `Field` renders
 * the error as `<p id="{id}-error">`, and the input's `aria-describedby` is derived from the same
 * `id` here rather than taken from the caller. Title and URL stay inline in both forms — they
 * differ only in placeholder and `autoFocus`, and there is no whole-field-set component because the
 * two forms order the fields differently.
 */

/**
 * The props {@link DescriptionField}, {@link ContentField} and {@link TagsField} share.
 *
 * `id` is the caller's, not derived here, because the two forms prefix theirs differently
 * (`item-title` vs `new-item-title`) so both can be open at once without colliding.
 */
type ItemFieldProps = {
    id: string;
    value: string;
    onChange: (value: string) => void;
    error?: string;
};

/**
 * The AI-suggestion button shared by {@link DescriptionField} and {@link TagsField}, rendered into
 * `Field`'s `action` slot.
 *
 * One button so the two cannot drift on size, spacing, or the pending animation. Both carry visible
 * text — an icon alone is unclear on a control that spends the user's rate limit, and a tooltip is
 * no answer on a touch screen. `pendingText` is per-field so the verb matches the button (tags
 * "suggests", description "writes").
 *
 * @remarks
 * `label` is the accessible name and the tooltip, and must **contain** the visible `text`: WCAG
 * 2.5.3 (Label in Name) is what makes "click Describe" work for voice control, so an `aria-label`
 * extends the visible word rather than replacing it.
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
 * The Description field, with an AI "write one for me" action.
 *
 * The button icon is `PenLine` — it names the action — and is neither `Sparkles` (the Prompt
 * type's icon) nor `Lightbulb` ({@link TagsField}'s button, in the same form). It says "Describe",
 * a verb carrying its own object, so it reads beside a label that already says "Description".
 *
 * @remarks
 * The result never overwrites text the user wrote: an empty field is filled directly, a non-empty
 * one gets a proposal underneath that is accepted or dismissed like a suggested tag, with the same
 * two controls and colours.
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
    // Controls appearance, not access: `generateDescription` re-checks entitlement server-side.
    // This only keeps a control that would always fail off a free account's screen.
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
                /* A block, not the tags' inline badge, because a sentence would wrap by word and
                   strand the controls at the end. Colours match the tag suggestions: blue for a
                   proposal that is not yet the field's value, green and red for the two opposite
                   actions. */
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
 * An item's body, in {@link CodeEditor} or {@link MarkdownEditor} by type.
 *
 * `isCode` is the caller's `itemTypeOwns(...).language`: "content is code" and "has a language
 * worth declaring" are one question, so an item is never edited in one editor and displayed in the
 * other. The `language` prop is live — retyping it re-highlights as you go.
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
 * The picker's label for an undeclared language.
 *
 * "Plain text" names the outcome — no highlighting — where "None" would name an absence. It reads
 * as a readable phrase here; `CodeEditor`'s monospace header shows the same state as the token
 * `text` (see `codeLanguageLabel`).
 *
 * @remarks
 * The option writes an empty string, which `blankToNull` in `item-schemas.ts` stores as `null`.
 * Writing the literal `"plaintext"` would put a `plaintext` badge on every unlabelled snippet,
 * since `ItemDrawer` renders a badge for any truthy `language`.
 */
const PLAIN_TEXT_LABEL = "Plain text";

/**
 * The picker for the language the content is highlighted as.
 *
 * Rendered above the content in both forms, since it is what the editor highlights by. A dropdown
 * modelled on `PreferenceSelect` in `settings/EditorPreferencesRows.tsx` — the app's "pick one of a
 * list" control — with Radix typeahead over the labels, so a thirty-item list stays usable without
 * a searchable combobox.
 *
 * @remarks
 * Writes a monaco language id, so the stored value needs no alias lookup to highlight. Reads
 * anything, since items predate the list: `findCodeLanguage` resolves aliases (an item stored as
 * `TS` shows TypeScript), and a value matching nothing is rendered as its own option rather than
 * dropped. `onChange` fires only on a real choice, so opening a form rewrites nothing.
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
 * The comma-separated tag input, with AI tag suggestions beside it.
 *
 * One string here, split on submit and normalized by the schema (trim, drop blanks, de-duplicate).
 * `draft` carries the title and body *as typed now*, since the create dialog has no saved item and
 * the edit form's inputs have moved on from the stored one; a form that passes no `draft` renders
 * the plain field.
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
    // Controls appearance, not access: `generateAutoTags` re-checks entitlement server-side. This
    // only keeps a control that would always fail off a free account's screen.
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
                    /* `Lightbulb`, not `Sparkles`: `Sparkles` is the Prompt type's icon, so the
                       button and a prompt item would render the same glyph a few pixels apart. A
                       lightbulb is three paths, reads cleanly at 14px, and means "suggestion". */
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
                /* Per-tag accept and reject, not one "apply all": the model is usually right about
                   most of a list and wrong about one. The tag text is not itself a button — two
                   adjacent targets are enough. */
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    <span className="text-xs text-muted-foreground">Suggested:</span>

                    {suggestions.map((tag) => (
                        /* Blue for the tag, because it is a proposal rather than settled text in
                           the input above. Green and red for accept and reject, so the two
                           opposite actions are not a pair of identical grey glyphs. */
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
 * The multi-select for which collections an item belongs to — any number, including none.
 *
 * `ToggleChip` checkboxes over a `<select multiple>`, so "pick several" reads the same as the type
 * selector and keeps the native checkbox's keyboard and screen-reader behaviour. The one field here
 * that does not use `Field`: a checkbox group has no single input for a `<label htmlFor>` to point
 * at, so it is a `<fieldset>`/`<legend>` with `aria-describedby` tying the error to the group.
 *
 * @remarks
 * `options` is the caller's, not fetched here: only the caller knows whether the list loaded, which
 * is what decides whether a membership list may be submitted at all. Submitting an empty one after
 * a failed load would read as "remove this item from every collection".
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
                // Uncapped: a `max-h` here would give the list its own scrollbar inside a panel
                // that already scrolls (the drawer's sheet, the dialog's `DialogContent`), leaving
                // two nested scrollbars for one field.
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
