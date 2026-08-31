/**
 * The "or" rule between the OAuth button and the credentials form.
 *
 * Extracted rather than copied the moment `/register` grew a GitHub button too: it is five lines of
 * markup, but they are five lines whose *only* job is to make the two auth pages look like the same
 * screen, so a copy that drifts is a copy that defeats the point of having it.
 *
 * Presentational and server-safe — no state, no handlers — so it stays out of both pages' client
 * boundary.
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
