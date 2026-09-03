/**
 * The "or" rule between the OAuth button and the credentials form.
 *
 * Shared by `/sign-in` and `/register` so the two pages keep an identical divider. Presentational
 * and server-safe — no state, no handlers.
 */
export function AuthDivider() {
    return (
        <div className="my-5 flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground uppercase">or</span>
            <span className="h-px flex-1 bg-border" />
        </div>
    );
}
