"use client";

import { Check, Folder } from "lucide-react";

import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/input";
import { ToggleChip } from "@/components/ui/ToggleChip";
import { CodeEditor } from "./CodeEditor";
import { MarkdownEditor } from "./MarkdownEditor";

/**
 * The fields the create dialog and the edit drawer render identically.
 *
 * Only these four. Title, description, and URL look similar but differ in placeholder, `rows`, and
 * `autoFocus`, and pulling them in here would turn readable markup into prop-level configuration.
 * There is deliberately no component covering the whole field *set* either: the two forms order them
 * differently — create puts URL and the upload before the content, edit puts description before the
 * language — so a shared wrapper would have to take the order as a prop, which is worse than the
 * duplication it removes.
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
 * The language the content is highlighted as.
 *
 * Rendered above the content in both forms, deliberately: it is what the editor highlights by, so
 * asking for it after the code has been written is asking too late.
 */
export function LanguageField({ id, value, onChange, error }: ItemFieldProps) {
    return (
        <Field id={id} label="Language" error={error}>
            <Input
                id={id}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder="e.g. typescript"
                {...invalidProps(id, error)}
            />
        </Field>
    );
}

/**
 * The comma-separated tag input.
 *
 * One string here, split on submit and normalized by the schema — trimming, dropping blanks, and
 * de-duplicating happen in the one place that also has to reject a bad payload.
 */
export function TagsField({ id, value, onChange, error }: ItemFieldProps) {
    return (
        <Field id={id} label="Tags" error={error} hint="Separate tags with commas.">
            <Input
                id={id}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder="e.g. react, hooks"
                {...invalidProps(id, error)}
            />
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
