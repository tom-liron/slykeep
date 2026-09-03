/**
 * A labelled input with room for one error message under it — the field shape every auth and
 * account form uses (sign-in, register, reset, change password, delete account).
 *
 * The auth counterpart to `Field` in `ui/Field.tsx`: that one labels at `text-xs` muted with an
 * optional `hint`, for the item forms; this labels at `text-sm font-medium` and never hints. The
 * two share `invalidProps` — this composes with the one exported from `Field.tsx`.
 *
 * The control is `children`, not a prop, so a call site can pass `Input`, `PasswordInput`, or a
 * variant with its own `aria-invalid` handling — `SignInForm` marks both fields on a rejected
 * credential without naming either. This owns the wrapper, the label, and the message, and leaves
 * the control alone.
 *
 * Presentational and server-safe: no state, no handlers, no `"use client"`.
 *
 * @remarks
 * The `${id}-error` id here is the other half of the `aria-describedby` that `invalidProps` builds
 * from the same `id`. Sharing the derivation is the point: a hand-written pair that disagrees
 * fails silently, visible only to a screen reader.
 */
export function AuthField({
    id,
    label,
    error,
    action,
    children,
}: {
    id: string;
    /** A node, not a string: the delete-account field's label contains a `<span>`. */
    label: React.ReactNode;
    error?: string;
    /** A control on the label's row — the sign-in password field's "Forgot password?" link. */
    action?: React.ReactNode;
    children: React.ReactNode;
}) {
    const labelElement = (
        <label htmlFor={id} className="text-sm font-medium">
            {label}
        </label>
    );

    return (
        <div className="space-y-1.5">
            {/* The label's row wrapper is rendered only when an `action` sits in it, so a field
                without one keeps the bare `<label>` and no extra `<div>`. */}
            {action ? (
                <div className="flex items-baseline justify-between gap-3">
                    {labelElement}
                    {action}
                </div>
            ) : (
                labelElement
            )}

            {children}

            {error && (
                <p id={`${id}-error`} className="text-sm text-destructive">
                    {error}
                </p>
            )}
        </div>
    );
}
