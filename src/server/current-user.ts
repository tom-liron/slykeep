import "server-only";

import { cache } from "react";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { UserViewModel } from "@/types/view-models";
import { buildUserViewModel } from "./view-models";

/**
 * Every user-scoped read in the app resolves its owner here, so this is the one place a session
 * becomes a user id.
 *
 * There is deliberately no fallback. An unauthenticated request must fail, never quietly resolve to
 * some default account — that would hand every signed-out visitor the same shared data instead of
 * denying them. `src/proxy.ts` redirects them long before this runs, so throwing here is a
 * backstop for a bug in that matcher, not an expected path.
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

/** The signed-in user prepared for display. Same session resolution as `getCurrentUserId`. */
export const getCurrentUser = cache(async (): Promise<UserViewModel> => {
    const userId = await getCurrentUserId();

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true, image: true, isPro: true },
    });

    // The session carries an id for a row that no longer exists — a deleted account with a live
    // JWT. Fail rather than render a half-built shell.
    if (!user) {
        throw new Error(`Session user ${userId} not found.`);
    }

    return buildUserViewModel(user);
});
