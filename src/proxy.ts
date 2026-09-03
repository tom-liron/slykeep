import { NextResponse } from "next/server";
import NextAuth from "next-auth";

import { OPEN_ROUTES, SIGNED_OUT_ROUTES } from "@/lib/auth-redirects";
import authConfig from "./auth.config";

/**
 * Deny-by-default route protection, running on the edge in front of every request.
 *
 * The first authorization boundary in the application: a request arrives, this reads the session
 * JWT, and only then does a route handler or a server component run. It decides three things — an
 * unauthenticated visitor is redirected to `/sign-in` with a callback URL, the root is rewritten to
 * the marketing page instead, and a signed-in visitor is bounced off the signed-out pages.
 *
 * The route sets it works from live in `lib/auth-redirects.ts`, which the sign-in Server Action also
 * reads, so the bounce and the return trip agree on what counts as a signed-out route.
 *
 * @remarks
 * It builds its own NextAuth instance from the edge-safe `auth.config.ts` and must never import
 * `@/auth`, which would pull the Prisma adapter into the edge bundle. This instance can authorize
 * but not query — everything downstream of it resolves the user through `getCurrentUserId`.
 *
 * @see {@link config}, whose matcher is what makes the protection deny-by-default.
 */

// `lib/auth-redirects` is safe to pull into the edge bundle for the same reason the config split
// exists: it is strings and string handling, with no Node built-ins behind it.
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
    // on the most common bounce in the app is noise: it survives the whole flow, encodes a slash into
    // something that looks like a bug, and changes nothing.
    if (target !== "/") signInUrl.searchParams.set("callbackUrl", target);

    return Response.redirect(signInUrl);
});

/**
 * Which requests the proxy runs on: everything except the exclusions named in the matcher.
 *
 * The rule is inverted rather than enumerated, so a new page is protected the moment it is added
 * rather than being public until someone remembers to extend a matcher. There is no `/dashboard/*`
 * to protect — `(dashboard)` is a route *group* and contributes nothing to the path — so the
 * protected routes are `/`, `/collections`, `/collections/[id]`, `/items/[slug]` and the rest of the
 * signed-in area.
 *
 * The signed-out routes are handled in the callback above rather than excluded here: the matcher
 * decides only whether the proxy runs at all, and an excluded path could never be redirected *away
 * from* when a signed-in user lands on it.
 *
 * @remarks
 * Three API paths are excluded. Each is named in full rather than by its prefix, so that a route
 * added later under the same prefix does not inherit an exclusion it never earned — `api/webhook`
 * would open every future webhook, and `api/cron` every future scheduled job. Each of the three
 * carries its own request authentication in place of the session:
 *
 * - `api/auth` must stay open or the sign-in flow would redirect to itself.
 * - `api/webhook/stripe` — Stripe's `POST` carries no session cookie, so the proxy would answer it
 *   with a 302 to `/sign-in`. Stripe records that as a failed delivery, retries with backoff for
 *   days and eventually disables the endpoint, while the handler is never invoked and nothing is
 *   logged on this side. Its authentication is the `stripe-signature` header, verified against
 *   `STRIPE_WEBHOOK_SECRET`.
 * - `api/cron/sweep-unverified` — its authentication is the `CRON_SECRET` bearer token Vercel sends.
 *   Left inside the matcher it fails in the quietest way this file can produce: the request carries
 *   no session cookie, the proxy answers 302, and Vercel records a 302 as a *successful* invocation,
 *   so the schedule reports green every night while the sweep never runs.
 *
 * `monaco` is excluded on different grounds: it is the editor build in `public/`, not a route, and
 * holds nothing of anyone's. Files under `public/` are not covered by the `_next/static` exclusion,
 * so without this every one of monaco's several hundred chunks makes a round trip through the
 * session check on its way to being served.
 */
export const config = {
    matcher: [
        "/((?!api/auth|api/webhook/stripe|api/cron/sweep-unverified|_next/static|_next/image|monaco|favicon.ico).*)",
    ],
};
