import "server-only";

import { parseEditorPreferences } from "@/lib/editor-preferences";
import { prisma } from "@/server/infra/prisma";
import type { EditorPreferences } from "@/types/editor";
import type { AccountSettingsViewModel, ProfileViewModel } from "@/types/view-models";
import { getCurrentUser, getCurrentUserId } from "./current-user";
import { getItemTypeCounts } from "./item-types";

/**
 * The account-page reads: the profile summary, the settings page's account section, and the stored
 * editor preferences.
 *
 * Three queries that share an owner and little else. {@link getProfile} feeds the read-only profile
 * page; {@link getAccountSettings} feeds the settings page's password and delete-account controls;
 * {@link getEditorPreferences} is read in the dashboard layout and handed to the provider every
 * editor surface reads from.
 */

/**
 * Everything the profile page renders, in one pass: identity, join date, totals and the per-type
 * breakdown.
 *
 * @throws When the session's account disappeared mid-request.
 *
 * @remarks
 * Totals come from `count()` rather than the length of a loaded list, and the breakdown from the
 * single `groupBy` in `getItemTypeCounts`. `getCurrentUser` is request-cached, so the display fields
 * are shared with the sidebar rather than re-read here.
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
 * What the settings page's account section needs: which password body to render, whether billing
 * blocks deletion, and the totals the delete confirmation quotes back.
 *
 * @throws When the session's account disappeared mid-request.
 *
 * @remarks
 * Separate from {@link getProfile} rather than a reuse of it: that query also runs a `groupBy` over
 * every item the user owns, which settings renders nothing from.
 *
 * The `password` column is selected but never returned — it collapses to `hasPassword`, which is all
 * the page needs in order to decide whether to offer the change-password form. A GitHub-only account
 * has a null hash and nothing to change.
 */
export async function getAccountSettings(): Promise<AccountSettingsViewModel> {
    const user = await getCurrentUser();

    const [account, totalItems, totalCollections] = await Promise.all([
        prisma.user.findUnique({
            where: { id: user.id },
            select: { password: true, stripeCancelAtPeriodEnd: true },
        }),
        prisma.item.count({ where: { userId: user.id } }),
        prisma.collection.count({ where: { userId: user.id } }),
    ]);

    // Same rule as `getProfile`: the session resolved to a row moments ago, so a miss means the
    // account went away mid-request. Fail rather than render a delete dialog for nothing.
    if (!account) {
        throw new Error(`Session user ${user.id} not found.`);
    }

    return {
        email: user.email,
        hasPassword: account.password !== null,
        // Pro *and* still renewing — both halves matter. Someone who cancelled through the portal
        // keeps Pro until the period they paid for runs out, so they are `isPro: true` with a
        // deletable account, because nothing further will be charged; branching on `isPro` alone
        // traps that person in a loop telling them to cancel what they have already cancelled.
        //
        // This mirrors `hasBillableSubscription` in `server/billing.ts` from the local columns
        // without replacing it — that one asks Stripe and is the control. Being wrong here is cheap
        // either way: a stale `true` shows a portal with nothing to cancel, and a stale `false` lets
        // someone through to the server check that actually decides.
        subscriptionBlocksDeletion: user.isPro && !account.stripeCancelAtPeriodEnd,
        totalItems,
        totalCollections,
    };
}

/**
 * How this account's content editors should render, validated back into
 * {@link EditorPreferences} by `parseEditorPreferences`.
 *
 * Read in the dashboard layout rather than on the settings page, because the settings panel is not
 * the only consumer: every editor in the app — the drawer, the create dialog, the edit form — needs
 * these values and they mount all over the tree. One read per page view feeds the provider, and the
 * panel that changes them sits inside it, which is why {@link getAccountSettings} does not also
 * select the column.
 *
 * @remarks
 * A missing row returns the defaults rather than throwing. Every other read in the layout resolves
 * through `getCurrentUser`, which already redirects a session whose account is gone; failing here as
 * well would only turn that redirect into a 500.
 */
export async function getEditorPreferences(): Promise<EditorPreferences> {
    const userId = await getCurrentUserId();

    const account = await prisma.user.findUnique({
        where: { id: userId },
        select: { editorPreferences: true },
    });

    return parseEditorPreferences(account?.editorPreferences);
}
