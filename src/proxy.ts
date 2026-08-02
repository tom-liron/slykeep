import NextAuth from "next-auth";

import authConfig from "./auth.config";

// Built from the edge-safe config only — importing `@/auth` here would drag the Prisma adapter into
// the edge bundle. This instance can authorize but not query.
const { auth } = NextAuth(authConfig);

/**
 * Routes for people who do not have a session yet. A signed-in visitor is sent to the app instead:
 * these forms would only sign them in as who they already are, or reset a password they evidently
 * remember.
 *
 * Verification deliberately has no entry. The spec called for `/verify-email` here, but the token
 * is consumed by a route handler at `/api/auth/verify-email`, and `api/auth` is already outside the
 * matcher below — listing a page path that does not exist would protect nothing and imply a route
 * someone would later go looking for.
 */
const SIGNED_OUT_ROUTES = new Set(["/sign-in", "/register", "/forgot-password"]);

/**
 * Reachable with or without a session.
 *
 * `/reset-password` cannot be in the set above. A reset link is opened from an inbox, in whatever
 * browser the mail client hands it to — quite possibly one still signed in as the person resetting,
 * or as somebody else on a shared machine. Redirecting a signed-in visitor to `/` would swallow the
 * link and leave them with no way to finish, and the page is safe for them anyway: it grants nothing
 * the token in the URL does not already.
 */
const OPEN_ROUTES = new Set(["/reset-password"]);

export const proxy = auth((req) => {
    const { pathname } = req.nextUrl;
    const isSignedOutRoute = SIGNED_OUT_ROUTES.has(pathname);

    if (req.auth) {
        if (isSignedOutRoute) return Response.redirect(new URL("/", req.nextUrl.origin));

        return;
    }

    if (isSignedOutRoute || OPEN_ROUTES.has(pathname)) return;

    const signInUrl = new URL("/sign-in", req.nextUrl.origin);
    signInUrl.searchParams.set("callbackUrl", `${req.nextUrl.pathname}${req.nextUrl.search}`);

    return Response.redirect(signInUrl);
});

/**
 * Deny by default: everything is protected except the exclusions below.
 *
 * The spec says to protect `/dashboard/*`, but no such URL exists here — `(dashboard)` is a route
 * *group*, so it contributes nothing to the path. The protected routes are actually `/`,
 * `/collections`, `/collections/[id]`, and `/items/[slug]`. A `/dashboard/:path*` matcher would
 * protect nothing at all, so this inverts the rule instead of enumerating routes: new pages are
 * covered the moment they are added, rather than being public until someone remembers the matcher.
 *
 * The signed-out routes are handled in the callback above rather than excluded here, because the
 * matcher decides only whether this runs at all — an excluded path could never be redirected *away
 * from* when a signed-in user lands on it.
 *
 * `api/auth` must stay open or the sign-in flow would redirect to itself.
 */
export const config = {
    matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
