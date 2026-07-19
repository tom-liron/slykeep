import "server-only";

import { prisma } from "@/lib/prisma";
import type { UserViewModel } from "@/types/view-models";
import { buildUserViewModel } from "./view-models";

/**
 * TEMPORARY, until roadmap Phase 1 lands NextAuth.
 *
 * Collections and items are user-scoped columns in the database, so every read needs an owner —
 * but there is no session to take one from yet. Reads therefore resolve the seeded demo user.
 * This is deliberately the *only* place that happens: when auth arrives, this function becomes the
 * session lookup and no query module changes.
 */
const DEMO_USER_EMAIL = "demo@devstash.io";

export async function getCurrentUserId(): Promise<string> {
    const user = await prisma.user.findUnique({
        where: { email: DEMO_USER_EMAIL },
        select: { id: true },
    });

    if (!user) {
        throw new Error(
            `Demo user ${DEMO_USER_EMAIL} not found. Run \`npm run db:seed\` to populate the database.`,
        );
    }

    return user.id;
}

/** The signed-in user prepared for display. Same demo-user resolution as `getCurrentUserId`. */
export async function getCurrentUser(): Promise<UserViewModel> {
    const user = await prisma.user.findUnique({
        where: { email: DEMO_USER_EMAIL },
        select: { id: true, name: true, email: true, image: true, isPro: true },
    });

    if (!user) {
        throw new Error(
            `Demo user ${DEMO_USER_EMAIL} not found. Run \`npm run db:seed\` to populate the database.`,
        );
    }

    return buildUserViewModel(user);
}
