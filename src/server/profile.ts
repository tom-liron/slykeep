import "server-only";

import { prisma } from "@/lib/prisma";
import type { ProfileViewModel } from "@/types/view-models";
import { getCurrentUser } from "./current-user";
import { getItemTypeCounts } from "./item-types";

/**
 * Everything the profile page renders, in one pass.
 *
 * Totals come from `count()` rather than the length of a loaded list, and the per-type breakdown
 * from a single `groupBy` in `getItemTypeCounts` — the same shape the dashboard and sidebar reads
 * settled on. `getCurrentUser` is request-cached, so the display fields are shared with the sidebar
 * rather than re-read here.
 *
 * The `password` column is selected but never returned: it collapses to `hasPassword`, which is all
 * the page needs in order to decide whether to offer the change-password form. A GitHub-only
 * account has a null hash (see `User.password` in the schema) and nothing to change.
 */
export async function getProfile(): Promise<ProfileViewModel> {
    const user = await getCurrentUser();

    const [account, totalItems, totalCollections, itemTypeCounts] = await Promise.all([
        prisma.user.findUnique({
            where: { id: user.id },
            select: { createdAt: true, password: true },
        }),
        prisma.item.count({ where: { userId: user.id } }),
        prisma.collection.count({ where: { userId: user.id } }),
        getItemTypeCounts(user),
    ]);

    // `getCurrentUser` resolved a row a moment ago, so a miss here means the account was deleted
    // mid-request. Fail rather than render a profile with an invented join date.
    if (!account) {
        throw new Error(`Session user ${user.id} not found.`);
    }

    return {
        user,
        createdAt: account.createdAt.toISOString(),
        hasPassword: account.password !== null,
        totalItems,
        totalCollections,
        itemTypeCounts,
    };
}
