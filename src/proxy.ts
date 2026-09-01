import { NextResponse } from "next/server";
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

    // The root is the one protected path that does not bounce to sign-in: a landing page has to live
    // at the root domain, so a visitor with no session is served the marketing page from here.
    // A rewrite rather than a redirect — the URL they arrived at is the URL they should keep, and
    // `/welcome` is reachable on its own anyway for anyone who wants it.
    if (pathname === "/") {
        const welcome = req.nextUrl.clone();
        welcome.pathname = "/welcome";
        return NextResponse.rewrite(welcome);
    }

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
 *
 * `api/webhook/stripe` must stay open for the same shape of reason: Stripe's `POST` carries no
 * session cookie, so the proxy would answer it with a 302 to `/sign-in`. Stripe records that as a
 * failed delivery, retries with backoff for days, and eventually disables the endpoint — while the
 * route handler is never invoked, so nothing is logged on this side either. Its own authentication
 * is the `stripe-signature` header, verified in the handler against `STRIPE_WEBHOOK_SECRET`.
 *
 * That one path, deliberately — **not** `api/webhook`, which would open every webhook endpoint
 * added after it, including one whose author never read this comment. Each one earns its exclusion
 * by having its own request authentication, so each one is named here separately.
 *
 * `api/cron/sweep-unverified` is the third of that kind, and it is named in full for exactly the
 * reason above — **not** `api/cron`, which would open every scheduled job added after it. Its own
 * authentication is the `CRON_SECRET` bearer token Vercel sends, verified in the handler. Left
 * inside the matcher it would fail in the quietest way this file can produce: the cron request
 * carries no session cookie, the proxy would answer 302 to `/sign-in`, and Vercel records a 302 as
 * a *successful* invocation — so the schedule would report green every night while the sweep never
 * ran once.
 *
 * `monaco` is the editor build in `public/`, and is excluded on different grounds from the rest: it
 * is not a route and holds nothing of anyone's. Files under `public/` are not covered by the
 * `_next/static` exclusion, so without this every one of monaco's several hundred chunks makes a
 * round trip through the session check on its way to being served.
 */
export const config = {
    matcher: [
        "/((?!api/auth|api/webhook/stripe|api/cron/sweep-unverified|_next/static|_next/image|monaco|favicon.ico).*)",
    ],
};
