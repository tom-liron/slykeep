/**
 * A labelled form input with room for one message under it — either the validation error the server
 * reported for that field, or a hint when there is nothing to report.
 *
 * Shared by the item forms rather than declared in each, so the create dialog and the edit drawer
 * cannot drift apart on label size, spacing, or where an error appears. The `id` is the input's, and
 * the error's id is derived from it, which is what `aria-describedby` on the input points at.
 */
export function Field({
    id,
    label,
    error,
    hint,
    children,
}: {
    id: string;
    label: string;
    error?: string;
    hint?: string;
    children: React.ReactNode;
}) {
    return (
        <div className="space-y-1.5">
            <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
                {label}
            </label>
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
