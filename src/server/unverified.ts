import "server-only";

import { prisma } from "@/lib/prisma";

/**
 * How long an unconfirmed registration keeps hold of its email address.
 *
 * Registration creates the `User` row before the verification email is sent, and until this existed
 * nothing ever removed it: `emailVerified` stayed null, the account could never sign in, and the
 * address was taken for good. So a typo at signup — `tomm@` for `tom@` — permanently locked that
 * address out of the product, and the person it actually belongs to hit the 409 in
 * `api/auth/register` with no route forward, since they cannot verify an account they did not
 * create.
 *
 * Seven days, which is the number GitLab's own issue proposes as a default for exactly this case
 * (its shipped behaviour is three). The tension is real in both directions — too short and someone
 * who signed up on a Friday and checked their mail the next weekend finds the account gone; too
 * long and the address stays hostage. A week covers the realistic gap between signing up and
 * reading the email, and the 24-hour token expiry means anyone past it is resending anyway.
 */
export const UNVERIFIED_ACCOUNT_TTL_DAYS = 7;

/** The instant before which an unconfirmed registration is old enough to sweep. */
export function unverifiedCutoff(now: Date): Date {
    return new Date(now.getTime() - UNVERIFIED_ACCOUNT_TTL_DAYS * 24 * 60 * 60 * 1000);
}

/**
 * Deletes registrations that were never confirmed, freeing the addresses they hold.
 *
 * **Every clause in this `where` is load-bearing, and three of them are guards rather than the
 * rule.** The rule is the first two: no `emailVerified`, and old enough. The rest exist because this
 * is a scheduled job that deletes user rows, and "an unverified account owns nothing" is an
 * assumption worth enforcing rather than trusting.
 *
 * - `password: { not: null }` restricts this to credentials registrations. An OAuth-only account has
 *   no password, and is not what this is for.
 * - `accounts: { none: {} }` is the one that matters most. A GitHub sign-up is stamped verified by
 *   the `linkAccount` event in `src/auth.ts` — but that is a *second* write, after the `User` and
 *   `Account` rows exist, and a transient failure there would leave a real GitHub account sitting at
 *   `emailVerified: null`. Requiring that no OAuth account is linked means such a row is never
 *   swept, whatever happened to that update.
 * - `items: { none: {} }` and `collections: { none: {} }` make the safety argument checkable instead
 *   of asserted. An account that cannot sign in cannot have created anything, so these should never
 *   exclude a row — and if that reasoning is ever wrong, this refuses to cascade someone's content
 *   away rather than proving the point the expensive way.
 *
 * Returns how many rows went, for the caller to log.
 */
export async function sweepUnverifiedAccounts(now: Date = new Date()): Promise<number> {
    const { count } = await prisma.user.deleteMany({
        where: {
            emailVerified: null,
            createdAt: { lt: unverifiedCutoff(now) },
            password: { not: null },
            accounts: { none: {} },
            items: { none: {} },
            collections: { none: {} },
        },
    });

    return count;
}
