"use client";

import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/input";
import { CodeEditor } from "./CodeEditor";
import { MarkdownEditor } from "./MarkdownEditor";

/**
 * The fields the create dialog and the edit drawer render identically.
 *
 * Only these three. Title, description, and URL look similar but differ in placeholder, `rows`, and
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
