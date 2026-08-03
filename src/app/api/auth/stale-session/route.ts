import { NextResponse } from "next/server";

import { auth, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";

/**
 * Clears a session whose user row no longer exists, then returns the visitor to the sign-in form.
 *
 * A JWT outlives the account it names — deleted from another device, or a dev database re-seeded —
 * and nothing about the token itself goes stale when that happens (see the session-revocation entry
 * in `context/project-overview.md` §11). `getCurrentUser` in `src/server/current-user.ts` sends the
 * request here instead of throwing, because a render cannot fix this on its own: server components
 * may not write cookies, so the one thing that would end the loop is unavailable exactly where the
 * problem is detected. A route handler may, so the sign-out happens here.
 *
 * Redirecting straight to `/sign-in` would not have worked either. The proxy sees a structurally
 * valid token, treats the visitor as signed in, and bounces them off `/sign-in` back to `/`, which
 * fails the same way — the cookie has to go first. `api/auth` is outside the proxy's matcher, and a
 * static segment beside the `[...nextauth]` catch-all wins over it: the same two reasons `register`
 * and `verify-email` live here.
 */
export async function GET(request: Request) {
    const session = await auth();

    // Built from `request.url` for the same reason `verify-email` does it: this redirect belongs on
    // whatever origin the visitor is actually on.
    const signInUrl = new URL("/sign-in", request.url);

    if (!session?.user?.id) return NextResponse.redirect(signInUrl);

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { id: true },
    });

    // The account is fine, so there is nothing to clear. This branch is what keeps the endpoint
    // safe to expose: a `GET` that unconditionally signed people out would be logout CSRF — an
    // `<img src=".../api/auth/stale-session">` on any page would drop a visitor's session. Confirming
    // the row is genuinely missing before touching the cookie makes a forced request inert.
    if (user) return NextResponse.redirect(new URL("/", request.url));

    // `redirect: false` so the response stays ours to build. Auth.js writes the cleared cookie
    // through `next/headers`, which a route handler applies to whatever it returns.
    await signOut({ redirect: false });

    signInUrl.searchParams.set("error", "SessionUserMissing");

    return NextResponse.redirect(signInUrl);
}
