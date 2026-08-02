/**
 * Which routes signed-out visitors may reach, and where a sign-in sends them afterwards.
 *
 * The route sets live here rather than in `src/proxy.ts` because two things need the same answer:
 * the proxy, deciding whether to bounce a request, and `resolveCallbackUrl` below, refusing to
 * return someone to a page they were never trying to reach. Two copies of that list would drift the
 * first time a route is added to one of them.
 *
 * Nothing in this module may import anything Node-only — the proxy runs on the edge.
 */

/**
 * Routes for people who do not have a session yet. A signed-in visitor is sent to the app instead:
 * these forms would only sign them in as who they already are, or reset a password they evidently
 * remember.
 *
 * Verification deliberately has no entry. The spec called for `/verify-email`, but the token is
 * consumed by a route handler at `/api/auth/verify-email`, and `api/auth` is outside the proxy's
 * matcher entirely — listing a page path that does not exist would protect nothing and imply a route
 * someone would later go looking for.
 */
export const SIGNED_OUT_ROUTES = new Set(["/sign-in", "/register", "/forgot-password"]);

/**
 * Reachable with or without a session.
 *
 * `/reset-password` cannot be in the set above. A reset link is opened from an inbox, in whatever
 * browser the mail client hands it to — quite possibly one still signed in as the person resetting,
 * or as somebody else on a shared machine. Redirecting a signed-in visitor to `/` would swallow the
 * link and leave them with no way to finish, and the page is safe for them anyway: it grants nothing
 * the token in the URL does not already.
 */
export const OPEN_ROUTES = new Set(["/reset-password"]);

/** Where sign-in lands when there is nowhere in particular to return to. */
export const DEFAULT_SIGN_IN_DESTINATION = "/?welcome=back";

/**
 * Validates a `callbackUrl` before anything is allowed to redirect to it.
 *
 * The value arrives in a query string, so it is attacker-supplied: a link to
 * `/sign-in?callbackUrl=https://evil.example` that sends the user there *after* they authenticate is
 * a textbook open redirect, and it is worth more than usual on a sign-in page — the destination
 * inherits the credibility of the site they just trusted with a password.
 *
 * So this accepts only same-origin *relative* paths, and nothing that can be talked into leaving:
 *
 *   - `https://evil.example` — absolute, rejected for not starting with `/`.
 *   - `//evil.example` — protocol-relative; a browser reads it as a full URL on the current scheme.
 *   - `/\evil.example` and `\/evil.example` — browsers normalize backslashes to forward slashes, so
 *     these become the case above after parsing. Rejecting the raw form is what closes it.
 *
 * The auth pages are refused too. Returning someone to `/sign-in` after a successful sign-in is a
 * loop, and the proxy would only bounce them off it again.
 *
 * Returns `null` when the value cannot be trusted, which every caller reads as "use the default".
 * Silently falling back is right here: a rejected callback is either a hand-edited URL or an attack,
 * and neither deserves an error message.
 */
export function resolveCallbackUrl(raw: string | string[] | undefined | null): string | null {
    // A duplicated param (`?callbackUrl=a&callbackUrl=b`) arrives as an array. Nothing legitimate
    // produces one and there is no sound way to choose between them.
    if (typeof raw !== "string") return null;
    if (!raw.startsWith("/")) return null;
    if (raw.startsWith("//") || raw.startsWith("/\\")) return null;

    const [pathname] = raw.split(/[?#]/);

    if (SIGNED_OUT_ROUTES.has(pathname) || OPEN_ROUTES.has(pathname)) return null;

    return raw;
}

/**
 * Builds the URL a successful sign-in redirects to.
 *
 * The `welcome` flag is only attached to the default destination, and deliberately not to a returned
 * callback. `WelcomeToast` — the thing that reads the flag — is rendered by `(dashboard)/page.tsx`
 * and nowhere else, and it clears the param with a hardcoded `router.replace("/")`. Appending the
 * flag to `/collections/abc` would therefore raise no toast and leave the param stuck in the URL,
 * and the day that component moves into the layout it would redirect the user off the very page they
 * asked for. Landing on the page they wanted is acknowledgement enough.
 */
export function signInDestination(callbackUrl: string | null): string {
    return callbackUrl ?? DEFAULT_SIGN_IN_DESTINATION;
}
