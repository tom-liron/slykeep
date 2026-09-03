import { NextResponse } from "next/server";

import { auth, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";

/**
 * Clears a session whose user row no longer exists, then returns the visitor to the sign-in form.
 *
 * A JWT outlives the account it names — deleted from another device, or a dev database re-seeded —
 * and the token itself does not go stale (see the session-revocation entry in
 * `context/project-overview.md` §11). `getCurrentUser` in `src/server/current-user.ts` sends the
 * request here rather than throwing, because a server component cannot write a cookie and the
 * cleared cookie is the only thing that ends the redirect loop. This route can, and does the
 * sign-out.
 *
 * @remarks
 * Redirecting to `/sign-in` alone does not help: the proxy sees a structurally valid token, treats
 * the visitor as signed in, and bounces them back to `/`. The cookie has to go first. `api/auth` is
 * outside the proxy's matcher and this static segment wins over the `[...nextauth]` catch-all, as
 * with `register` and `verify-email`.
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
