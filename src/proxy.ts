import NextAuth from "next-auth";

import authConfig from "./auth.config";

// Built from the edge-safe config only — importing `@/auth` here would drag the Prisma adapter into
// the edge bundle. This instance can authorize but not query.
const { auth } = NextAuth(authConfig);

/** Signed-out visitors need these; everything else requires a session. */
const PUBLIC_ROUTES = new Set(["/sign-in", "/register"]);

export const proxy = auth((req) => {
    const isPublic = PUBLIC_ROUTES.has(req.nextUrl.pathname);

    if (req.auth) {
        // Already signed in and asking for the sign-in form: send them to the app instead of
        // rendering a form that would only sign them in as who they already are.
        if (isPublic) return Response.redirect(new URL("/", req.nextUrl.origin));

        return;
    }

    if (isPublic) return;

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
 * `/sign-in` and `/register` are handled in the callback above rather than excluded here, because
 * the matcher decides only whether this runs at all — an excluded path could never be redirected
 * *away from* when a signed-in user lands on it.
 *
 * `api/auth` must stay open or the sign-in flow would redirect to itself.
 */
export const config = {
    matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
