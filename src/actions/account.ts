"use server";

import bcrypt from "bcryptjs";

import { signOut } from "@/auth";
import { changePasswordSchema } from "@/lib/auth-schemas";
import { fieldErrorsOf } from "@/lib/field-errors";
import { prisma } from "@/lib/prisma";
import { deleteUserObjects } from "@/lib/r2";
import { endBillingRelationship, hasBillableSubscription } from "@/server/billing";
import { getCurrentUser, getCurrentUserId } from "@/server/current-user";
import { hashPassword } from "@/server/passwords";
import { EMPTY_ACCOUNT_STATE, type AccountActionState } from "@/types/account";

/**
 * The two account mutations behind the profile page.
 *
 * Server Actions rather than route handlers — the standards' default, and neither needs what would
 * argue for a route: no webhook, no upload, no status code the caller has to read. That is the
 * difference from `api/auth/register`, where the form must tell a 409 from a 400. Both are also
 * reachable only with a session, so `getCurrentUserId` identifies the account and no request may
 * name the user it acts on.
 */

/**
 * Changes the signed-in account's password.
 *
 * The current password is re-checked here even though the caller holds a valid session: a session
 * is proof of who signed in at some point, not proof that whoever is at the keyboard now knows the
 * credential they are replacing. Without it an unattended browser is a password takeover.
 */
export async function changePassword(
    _previous: AccountActionState,
    formData: FormData,
): Promise<AccountActionState> {
    const userId = await getCurrentUserId();

    const parsed = changePasswordSchema.safeParse({
        currentPassword: formData.get("currentPassword"),
        password: formData.get("password"),
        confirmPassword: formData.get("confirmPassword"),
    });

    if (!parsed.success) {
        return { error: null, fields: fieldErrorsOf(parsed.error) };
    }

    try {
        const account = await prisma.user.findUnique({
            where: { id: userId },
            select: { password: true },
        });

        // No hash means a GitHub-only account, which has no password to replace. The page does not
        // render this form in that case; reaching it means a direct invocation, and setting one
        // here would let a session alone mint a password on an account that never had one.
        if (!account?.password) {
            return {
                error: "You sign in with GitHub, so there is no DevStash password to update.",
            };
        }

        if (!(await bcrypt.compare(parsed.data.currentPassword, account.password))) {
            return {
                error: null,
                fields: { currentPassword: "Your current password is incorrect." },
            };
        }

        await prisma.user.update({
            where: { id: userId },
            data: { password: await hashPassword(parsed.data.password) },
        });

        // The session deliberately survives — the person who just proved the old password is the
        // one holding it. Sessions on *other* devices survive too, which is the weaker half: JWTs
        // carry no version claim, so there is nothing to invalidate them against. Evicting them
        // needs that claim, and it is the same gap a password reset has (see History #26).
        return { error: null, success: true };
    } catch (error) {
        console.error("Password change failed:", error);

        return { error: "Could not update your password. Try again." };
    }
}

/**
 * Deletes the signed-in account and everything hanging off it.
 *
 * One `delete` is the whole operation *in Postgres*: items, collections, their tags, their join rows,
 * and the NextAuth `Account` / `Session` rows all cascade from `User` (see the schema's
 * `onDelete: Cascade`). Tags used to be the exception — global rows with no owner, left behind by
 * design — until they were scoped per account, which gave them an owner to cascade from.
 *
 * R2 is not in that cascade and has to be swept separately, or "delete my account" would leave every
 * file the account uploaded sitting in the bucket with nothing pointing at it — a retention promise
 * broken the day there are real users to make it to.
 *
 * Nothing invalidates a JWT held elsewhere, but nothing needs to: the row is gone, so
 * `getCurrentUser` throws for any surviving token and every authenticated read fails closed.
 *
 * Refused, however, while a subscription would still bill. Cancelling and deleting are two separate
 * controls: the row holding `stripeCustomerId` is the only pointer to the subscription, so deleting
 * it first would leave a card being charged for an account that no longer exists and nothing left in
 * the system able to find it. The app does not end a paid subscription on someone's behalf either —
 * the person who bought it ends it in Stripe's own UI, where it is confirmed on screen and by email.
 */
export async function deleteAccount(
    _previous: AccountActionState,
    formData: FormData,
): Promise<AccountActionState> {
    const user = await getCurrentUser();

    // Re-checked on the server even though the dialog will not enable its button until the typed
    // value matches. The typed confirmation exists to make the action deliberate, and a guard that
    // lives only in component state is not a guard — a double submit, a replayed action call, or a
    // browser that never ran the client bundle would all walk straight past it.
    //
    // Compared case-insensitively: the address is echoed on screen to be copied, GitHub can supply
    // a mixed-case one (see History #21), and the point is to prove intent, not spelling.
    const confirmation = String(formData.get("confirmation") ?? "").trim();

    if (confirmation.toLowerCase() !== user.email.toLowerCase()) {
        return {
            error: null,
            fields: { confirmation: "The email address doesn't match." },
        };
    }

    // Asked of Stripe rather than of `user.isPro`, and that is the whole point: `isPro` is only as
    // current as the last webhook that landed, so a missed delivery leaves the row saying "free" for
    // an account Stripe is still billing — which is precisely the case this gate exists to catch.
    //
    // Refused rather than cancelled on the user's behalf. The account is still here afterwards, so
    // this is a route to the portal rather than a dead end, and the dialog offers that route
    // directly for anyone whose local state already says Pro.
    if (await hasBillableSubscription(user.id)) {
        return {
            error: "You still have an active Pro subscription. Cancel it first — the button is in Settings → Billing — and then you can delete your account.",
        };
    }

    try {
        // Best-effort, and deliberately not load-bearing: the gate above has already established
        // that nothing is going to bill this customer, so a failure here costs no money. It removes
        // the stored card and the customer record belonging to someone who will have no account,
        // which is worth doing and is not worth blocking a deletion over — a Stripe outage must not
        // stop someone leaving.
        //
        // Before the row delete, because the cascade destroys the only copy of `stripeCustomerId`.
        await endBillingRelationship(user.id).catch((error) => {
            console.error("Stripe cleanup failed during account deletion:", error);
        });

        await prisma.user.delete({ where: { id: user.id } });
    } catch (error) {
        console.error("Account deletion failed:", error);

        return { error: "Could not delete your account. Try again." };
    }

    // *After* the row, unlike the Stripe cleanup above, and for the opposite reason: the cascade
    // destroys the only copy of `stripeCustomerId`, but it destroys nothing R2 needs — the objects
    // are keyed by user id, so the prefix outlives every row. Sweeping first would mean a failed
    // `user.delete` had just destroyed a live account's files, which is the one outcome worse than
    // an orphan. This is `deleteItem`'s trade at account scale.
    //
    // Best-effort and outside the try, like the item path: the account is already gone and the
    // user's request succeeded, so a bucket that is briefly unreachable is not something to report
    // to them or to roll back — there is nothing to roll back to. The leftover objects are what the
    // scheduled prefix sweep is for.
    try {
        await deleteUserObjects(user.id);
    } catch (error) {
        console.error(`Orphaned R2 objects after deleting account ${user.id}:`, error);
    }

    // Outside the try: `signOut` leaves by throwing NEXT_REDIRECT, which the catch above would
    // swallow — reporting a failure for a deletion that has already succeeded.
    //
    // Still `/sign-in`, where ordinary sign-out now goes to the marketing page: the sign-in page is
    // what reads `deleted=1` and confirms the account is gone. Landing on the marketing page would
    // swallow that acknowledgement and leave the user guessing whether it worked.
    await signOut({ redirectTo: "/sign-in?deleted=1" });

    return EMPTY_ACCOUNT_STATE;
}
