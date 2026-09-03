/**
 * Labelled form-field primitives for the item and collection forms, plus the two helpers that wire
 * a rejected field to its error message.
 *
 * {@link Field} is the item-form field shape (label, control, error-or-hint). {@link invalidProps}
 * and {@link invalidFor} build the `aria-invalid` / `aria-describedby` attributes that point an
 * input at the `${id}-error` element {@link Field} renders, so both halves of that id contract
 * live in one module. The auth forms use `AuthField` in `ui/AuthField.tsx`, which composes
 * {@link invalidProps} the same way.
 */

/**
 * The two ARIA attributes that point a rejected input at the message {@link Field} renders for it,
 * or `undefined` when there is no error.
 *
 * Returns `undefined`, not `{ "aria-invalid": false }`: spread into a JSX element, `undefined`
 * leaves the attribute off the DOM entirely, which is what assistive technology expects of a valid
 * field.
 *
 * @remarks
 * The `${id}-error` id built here has to match the one {@link Field} renders. A call site that
 * derives the id itself and gets it wrong points `aria-describedby` at nothing, with no error and
 * no warning — which is why the derivation lives here.
 */
export function invalidProps(id: string, error?: string) {
    return error ? { "aria-invalid": true, "aria-describedby": `${id}-error` } : undefined;
}

/**
 * {@link invalidProps} bound to a form's id prefix and error map, for forms that key their fields
 * by name rather than by full id.
 *
 * Returns a function a call site spreads onto each input as `invalid`. The `${prefix}-${field}` id
 * is composed here so the prefix stays a single edit.
 */
export function invalidFor<F extends string>(prefix: string, errors: Partial<Record<F, string>>) {
    return (field: F) => invalidProps(`${prefix}-${field}`, errors[field]);
}

/**
 * A labelled form input with room for one message under it — either the validation error the server
 * reported for that field, or a hint when there is nothing to report.
 *
 * Shared by the item forms so the create dialog and the edit drawer cannot drift apart on label
 * size, spacing, or where an error appears. The `id` is the input's; the error's id is derived
 * from it, which is what `aria-describedby` on the input points at.
 *
 * `action` is an optional control on the label's own row — the tags field puts its AI suggestion
 * button there. A field that passes no `action` renders just the label.
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
