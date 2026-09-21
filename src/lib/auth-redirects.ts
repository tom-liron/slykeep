/**
 * Which routes a signed-out visitor may reach, and where a completed sign-in sends them.
 *
 * `src/proxy.ts` reads the route sets to decide whether to bounce a request; {@link resolveCallbackUrl}
 * reads the same sets to refuse returning someone to a page they were never trying to reach. One
 * copy of each list, so the two cannot drift when a route is added.
 *
 * Nothing here may import a Node-only module — the proxy runs on the edge.
 */

/**
 * Routes for a visitor with no session yet. A signed-in visitor is sent to the app instead: these
 * forms would only sign them in as who they already are, or reset a password they evidently
 * remember.
 *
 * `/welcome` is the marketing homepage — reachable without a session, sent past by a signed-in
 * visitor, and refused as a post-sign-in destination.
 */
export const SIGNED_OUT_ROUTES = new Set(["/sign-in", "/register", "/forgot-password", "/welcome"]);

/**
 * Reachable with or without a session, for two different reasons.
 *
 * `/reset-password` and `/verify-email` are reached from an inbox, in whatever browser the mail
 * client hands the link to — possibly one signed in as the person who followed it, or as someone
 * else on a shared machine. Redirecting a signed-in visitor to `/` would swallow the link along
 * with its query string, which on `/verify-email` is the entire message. Neither page is unsafe for
 * them: `/reset-password` grants nothing the token in the URL does not, and `/verify-email` only
 * reports an outcome that `GET /api/auth/verify-email` has already applied.
 *
 * `/privacy` and `/terms` must be readable by anyone, search engines included. The proxy is
 * deny-by-default: a request with no session that is not listed in a route set here is redirected
 * to `/sign-in`, so without these entries a crawler would be served a login form in place of the
 * site's legal pages — which safe-browsing checks treat as a deceptive site. Both pages are static
 * and hold nothing of anyone's, so a signed-in reader is served them unchanged.
 */
export const OPEN_ROUTES = new Set(["/reset-password", "/verify-email", "/privacy", "/terms"]);

/** Where sign-in lands when there is nowhere in particular to return to. */
export const DEFAULT_SIGN_IN_DESTINATION = "/?welcome=signed-in";

/**
 * Validates a `callbackUrl` before anything redirects to it.
 *
 * @remarks
 * The value arrives in a query string, so it is attacker-supplied. A link to
 * `/sign-in?callbackUrl=https://evil.example` that forwards the user there after they authenticate
 * is an open redirect, worth more than usual on a sign-in page because the destination inherits the
 * trust of the site they just gave a password to. Only same-origin relative paths are accepted, and
 * nothing that a browser can be talked into treating as absolute:
 *
 *   - `https://evil.example` — rejected for not starting with `/`.
 *   - `//evil.example` — protocol-relative; a browser reads it as a full URL.
 *   - `/\evil.example` and `\/evil.example` — browsers normalize backslashes to forward slashes, so
 *     these become the case above; rejecting the raw form closes it.
 *
 * The auth pages are refused too — returning someone to `/sign-in` after a successful sign-in is a
 * loop. Returns `null` for anything untrusted, which every caller reads as "use the default": a
 * rejected callback is a hand-edited URL or an attack, and neither deserves an error message.
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
 * @remarks
 * The `welcome` flag is attached only to the default destination, not to a returned callback.
 * `WelcomeToast` reads the flag, is rendered only by `(dashboard)/page.tsx`, and clears the param
 * with a hardcoded `router.replace("/")` — so on `/collections/abc` the flag would raise no toast
 * and stick in the URL, and if that component ever moved into the layout it would redirect the user
 * off the page they asked for.
 */
export function signInDestination(callbackUrl: string | null): string {
    return callbackUrl ?? DEFAULT_SIGN_IN_DESTINATION;
}
