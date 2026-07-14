import "server-only";

import { prisma } from "@/lib/prisma";

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
