import "server-only";

import { prisma } from "@/server/infra/prisma";

/**
 * The rule for which abandoned registrations may be deleted, and the sweep that deletes them.
 *
 * Registration creates the `User` row before the verification email is sent, so an address typed
 * wrongly at signup would otherwise hold that address forever: nobody can confirm it, and the person
 * the address belongs to meets the 409 in `api/auth/register` with no route forward.
 *
 * Two callers run the same function: the nightly Vercel Cron behind
 * `api/cron/sweep-unverified/route.ts`, and `npm run users:sweep` for a run by hand.
 */

/**
 * How long an unconfirmed registration keeps hold of its email address.
 *
 * @remarks
 * A week covers the realistic gap between signing up and reading the email, and the 24-hour token
 * expiry means anyone past it is requesting a fresh link anyway. Shortening it strands someone who
 * signed up on a Friday and read their mail the next weekend; lengthening it keeps the address
 * hostage.
 */
export const UNVERIFIED_ACCOUNT_TTL_DAYS = 7;

/** The instant before which an unconfirmed registration is old enough to sweep. */
export function unverifiedCutoff(now: Date): Date {
    return new Date(now.getTime() - UNVERIFIED_ACCOUNT_TTL_DAYS * 24 * 60 * 60 * 1000);
}

/**
 * Deletes registrations that were never confirmed, freeing the addresses they hold.
 *
 * @returns How many rows went, for the caller to log.
 *
 * @remarks
 * Nothing of the owner's is destroyed by this, and that is a property of the gate rather than of the
 * query: an unconfirmed account is read-only from the moment it exists — see `server/access.ts` —
 * so it holds exactly the starter content `seedStarterContent` gave it and nothing else. The old
 * `items: { none: {} }` guard cannot be kept for the same reason it is no longer needed: every
 * account is seeded, so "owns nothing" was never true of even a brand-new one.
 *
 * Every remaining clause in the `where` is a guard rather than the rule. The rule is the first two —
 * no `emailVerified`, and older than {@link unverifiedCutoff}:
 *
 * - `password: { not: null }` restricts the sweep to credentials registrations. An OAuth-only
 *   account has no password and is not what this is for.
 * - `accounts: { none: {} }` is the one that matters most. A GitHub sign-up is stamped verified by
 *   the `linkAccount` event in `src/auth.ts`, which is a *second* write after the `User` and
 *   `Account` rows exist; a transient failure there leaves a real GitHub account at
 *   `emailVerified: null`. Requiring that no OAuth account is linked means such a row is never
 *   swept.
 * - `isPro: false` with `stripeSubscriptionId: null` keeps any paying account out of reach. Checkout
 *   refuses an unconfirmed address, so this should never exclude a row — and if that ever ceases to
 *   hold, a nightly job must not be what discovers it.
 */
export async function sweepUnverifiedAccounts(now: Date = new Date()): Promise<number> {
    const { count } = await prisma.user.deleteMany({
        where: {
            emailVerified: null,
            createdAt: { lt: unverifiedCutoff(now) },
            password: { not: null },
            accounts: { none: {} },
            isPro: false,
            stripeSubscriptionId: null,
        },
    });

    return count;
}
