import "server-only";

import { prisma } from "@/lib/prisma";
import type { AccountSettingsViewModel, ProfileViewModel } from "@/types/view-models";
import { getCurrentUser } from "./current-user";
import { getItemTypeCounts } from "./item-types";

/**
 * Everything the profile page renders, in one pass.
 *
 * Totals come from `count()` rather than the length of a loaded list, and the per-type breakdown
 * from a single `groupBy` in `getItemTypeCounts` — the same shape the dashboard and sidebar reads
 * settled on. `getCurrentUser` is request-cached, so the display fields are shared with the sidebar
 * rather than re-read here.
 */
export async function getProfile(): Promise<ProfileViewModel> {
    const user = await getCurrentUser();

    const [account, totalItems, totalCollections, itemTypeCounts] = await Promise.all([
        prisma.user.findUnique({
            where: { id: user.id },
            select: { createdAt: true },
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
        totalItems,
        totalCollections,
        itemTypeCounts,
    };
}

/**
 * What the settings page's account section needs, and nothing more.
 *
 * Separate from `getProfile()` rather than a reuse of it: that query also runs `getItemTypeCounts`,
 * a `groupBy` over every item the user owns, which settings renders nothing from. The two counts it
 * *does* share are cheap aggregates the delete confirmation quotes back to the user.
 *
 * The `password` column is selected but never returned: it collapses to `hasPassword`, which is all
 * the page needs in order to decide whether to offer the change-password form. A GitHub-only
 * account has a null hash (see `User.password` in the schema) and nothing to change.
 */
export async function getAccountSettings(): Promise<AccountSettingsViewModel> {
    const user = await getCurrentUser();

    const [account, totalItems, totalCollections] = await Promise.all([
        prisma.user.findUnique({
            where: { id: user.id },
            select: { password: true },
        }),
        prisma.item.count({ where: { userId: user.id } }),
        prisma.collection.count({ where: { userId: user.id } }),
    ]);

    // Same reasoning as `getProfile`: the session resolved to a row moments ago, so a miss means the
    // account went away mid-request. Fail rather than render a delete dialog for nothing.
    if (!account) {
        throw new Error(`Session user ${user.id} not found.`);
    }

    return {
        email: user.email,
        hasPassword: account.password !== null,
        totalItems,
        totalCollections,
    };
}
