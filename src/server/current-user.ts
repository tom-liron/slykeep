import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { auth } from "@/auth";
import { prisma } from "@/server/infra/prisma";
import type { UserViewModel } from "@/types/view-models";
import { buildUserViewModel } from "./view-models";

/**
 * The single point where a NextAuth session becomes an application user.
 *
 * Every user-scoped read in `server/` and every write in `actions/` starts here: `auth()` resolves
 * the JWT, and this module turns it into an owner id for a `where` clause, or into the
 * {@link UserViewModel} the sidebar, account menu and profile page render. Nothing else in the
 * application reads `session.user.id` directly, so ownership scoping has one definition.
 *
 * Both functions are wrapped in React's {@link cache}, so a page that resolves the user in its
 * layout, its sidebar and three of its queries pays for one session decode and one row read.
 *
 * @see `src/proxy.ts`, which denies unauthenticated requests before any of this runs.
 */

/**
 * The signed-in user's id, for scoping a query by owner.
 *
 * @throws When there is no authenticated session.
 *
 * @remarks
 * There is no fallback, and there must not be one: an unauthenticated request has to fail rather
 * than quietly resolve to some default account, which would hand every signed-out visitor the same
 * shared data instead of denying them. The proxy redirects such a request long before this runs, so
 * the throw is a backstop against a gap in that matcher rather than an expected path.
 */
export const getCurrentUserId = cache(async (): Promise<string> => {
    const session = await auth();

    if (!session?.user?.id) {
        throw new Error(
            "No authenticated session. This route should be protected by src/proxy.ts.",
        );
    }

    return session.user.id;
});

/**
 * The signed-in user prepared for display, read from the database rather than from the session
 * alone, so callers see account state — `isPro` in particular — that the token does not carry.
 *
 * Redirects to `/api/auth/stale-session` when the session names a row that no longer exists.
 */
export const getCurrentUser = cache(async (): Promise<UserViewModel> => {
    const userId = await getCurrentUserId();

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            name: true,
            email: true,
            image: true,
            isPro: true,
            // Read from the row and never from the session token: the JWT is reissued on
            // `updateAge` (24h), so a token-borne flag would leave someone who confirmed on their
            // phone read-only on their laptop for a day.
            emailVerified: true,
        },
    });

    // The session carries an id for a row that no longer exists — a deleted account with a live
    // JWT, or a development database re-seeded underneath one.
    //
    // Throwing here 500s every page with no way out: the token still parses, so the proxy treats
    // the visitor as signed in and redirects them off `/sign-in` back to `/`, which throws again.
    // The cookie is what has to go, and a server component may not write cookies — so this hands
    // off to a route handler that can.
    if (!user) {
        redirect("/api/auth/stale-session");
    }

    return buildUserViewModel(user);
});
