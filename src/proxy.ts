import NextAuth from "next-auth";

import { OPEN_ROUTES, SIGNED_OUT_ROUTES } from "@/lib/auth-redirects";
import authConfig from "./auth.config";

// Built from the edge-safe config only — importing `@/auth` here would drag the Prisma adapter into
// the edge bundle. This instance can authorize but not query. `lib/auth-redirects` is safe to pull
// in for the same reason: it is strings and string handling, with no Node built-ins behind it.
const { auth } = NextAuth(authConfig);

export const proxy = auth((req) => {
    const { pathname } = req.nextUrl;
    const isSignedOutRoute = SIGNED_OUT_ROUTES.has(pathname);

    if (req.auth) {
        if (isSignedOutRoute) return Response.redirect(new URL("/", req.nextUrl.origin));

        return;
    }

    if (isSignedOutRoute || OPEN_ROUTES.has(pathname)) return;

    const signInUrl = new URL("/sign-in", req.nextUrl.origin);
    const target = `${pathname}${req.nextUrl.search}`;

    // Omitted when the target is the destination sign-in would have chosen anyway. `?callbackUrl=%2F`
    // on the most common bounce in the app is pure noise in the address bar: it survives the whole
    // flow, encodes a slash into something that looks like a bug, and changes nothing.
    if (target !== "/") signInUrl.searchParams.set("callbackUrl", target);

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
