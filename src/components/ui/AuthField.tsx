/**
 * A labelled input with room for one error message under it — the shape every auth and account form
 * uses, and one they had each written out for themselves.
 *
 * Separate from `ui/Field.tsx` rather than a variant of it, deliberately. That one labels at
 * `text-xs font-medium text-muted-foreground` and offers a `hint`, which is the item-form shape;
 * these label at `text-sm font-medium` and never hint. Collapsing the two would mean a `size` prop
 * whose two values are read as "the item forms" and "the auth forms", which is a worse thing to have
 * to know than two small components. What the two genuinely share is `invalidProps`, and they share
 * it — this composes with the one exported from `Field.tsx`.
 *
 * The input itself is `children` rather than a prop, because the nine call sites pass four different
 * controls (`Input`, `PasswordInput`, one with `data-1p-ignore`, one controlled) and because two of
 * them need to say something about `aria-invalid` that this component cannot know — `SignInForm`
 * marks *both* of its fields when the credential is rejected without naming either. Owning the
 * wrapper, the label and the message, and leaving the control alone, is what lets those two stay
 * themselves rather than forcing an escape-hatch prop.
 *
 * The `${id}-error` here is the other half of the `aria-describedby` that `invalidProps` builds from
 * the same `id`. That is the whole reason this is worth sharing: nine hand-written pairs of ids had
 * to agree with nothing checking that they did, and a mismatch is silent — the field renders, the
 * message shows, and only a screen reader notices the two are no longer connected.
 *
 * Presentational and server-safe: no state, no handlers, no `"use client"`. Every current caller is
 * already a client component, but nothing here makes that necessary.
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
            {/* The row only exists when something has to sit in it. Wrapping unconditionally would
                be three lines shorter here and would add a `<div>` to the eight fields that have no
                action — a DOM change to eight of nine call sites to serve the ninth. */}
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
