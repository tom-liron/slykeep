/**
 * The two ARIA attributes that point a rejected input at the message `Field` renders for it, or
 * `undefined` when there is nothing to report.
 *
 * `undefined` rather than `{ "aria-invalid": false }` on purpose: spread into a JSX element, that
 * leaves the attribute off the DOM entirely, which is what assistive technology expects of a field
 * that is simply valid.
 *
 * This is the other half of the `${id}-error` contract `Field` renders below — the two derivations
 * of that one string now live in the same module, which is the point. Four form modules used to
 * rebuild it from a prefix and a field name, and they agreed with `Field` only because every call
 * site happened to pass a matching `id`; renaming one prefix pointed `aria-describedby` at an
 * element that did not exist, with no error and no warning.
 */
export function invalidProps(id: string, error?: string) {
    return error ? { "aria-invalid": true, "aria-describedby": `${id}-error` } : undefined;
}

/**
 * `invalidProps` bound to a form's id prefix and its error map, for the forms that key their fields
 * by name rather than by full id.
 *
 * The returned function is what a call site names `invalid` and spreads onto each input. Composing
 * the id here — `${prefix}-${field}` — rather than at four call sites is what keeps the prefix a
 * single edit.
 */
export function invalidFor<F extends string>(prefix: string, errors: Partial<Record<F, string>>) {
    return (field: F) => invalidProps(`${prefix}-${field}`, errors[field]);
}

/**
 * A labelled form input with room for one message under it — either the validation error the server
 * reported for that field, or a hint when there is nothing to report.
 *
 * Shared by the item forms rather than declared in each, so the create dialog and the edit drawer
 * cannot drift apart on label size, spacing, or where an error appears. The `id` is the input's, and
 * the error's id is derived from it, which is what `aria-describedby` on the input points at.
 *
 * `action` is an optional control on the label's own row — the tags field puts its AI suggestion
 * button there. A slot rather than each field building its own header, so a field that passes
 * nothing renders exactly the markup it did before this existed.
 */
export function Field({
    id,
    label,
    error,
    hint,
    action,
    children,
}: {
    id: string;
    label: string;
    error?: string;
    hint?: string;
    /** Rendered at the end of the label's row, vertically centred against it. */
    action?: React.ReactNode;
    children: React.ReactNode;
}) {
    return (
        <div className="space-y-1.5">
            {/* `min-h` on the row rather than the label, so a field with an action and one without
                put their inputs at the same offset from the label above them — the button is taller
                than the text it sits beside. */}
            <div className="flex min-h-5 items-center justify-between gap-2">
                <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
                    {label}
                </label>
                {action}
            </div>
            {children}
            {error ? (
                <p id={`${id}-error`} className="text-sm text-destructive">
                    {error}
                </p>
            ) : (
                hint && <p className="text-xs text-muted-foreground">{hint}</p>
            )}
        </div>
    );
}
