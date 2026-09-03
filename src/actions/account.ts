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
 * The two account mutations behind the settings page: changing a password, and deleting the account.
 *
 * Server Actions rather than route handlers, by the standards' default — neither needs a webhook, an
 * upload, or an HTTP status the caller has to read, which is the difference from
 * `api/auth/register`, whose form must tell a 409 from a 400. Both are reachable only with a
 * session, so `getCurrentUserId` identifies the account and no payload may name the user it acts on.
 *
 * {@link deleteAccount} is the widest-reaching write in the application: it ends the Stripe
 * relationship, deletes the `User` row and everything Postgres cascades from it, and sweeps the
 * account's objects out of R2 — in that order, for the reasons stated on it.
 */

/**
 * Changes the signed-in account's password, after re-checking the current one.
 *
 * @remarks
 * The current password is re-checked even though the caller holds a valid session: a session is
 * proof of who signed in at some point, not proof that whoever is at the keyboard now knows the
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
        // render this form in that case; reaching it means a direct invocation, and setting one here
        // would let a session alone mint a password on an account that never had one.
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

        // This session survives — the person who just proved the old password is the one holding it.
        // Sessions on *other* devices survive too, which is the weaker half: JWTs carry no version
        // claim, so there is nothing to invalidate them against. Evicting them needs that claim, and
        // a password reset has the same gap.
        return { error: null, success: true };
    } catch (error) {
        console.error("Password change failed:", error);

        return { error: "Could not update your password. Try again." };
    }
}

/**
 * Deletes the signed-in account and everything hanging off it, then signs the user out.
 *
 * One `delete` is the whole operation *in Postgres*: items, collections, tags, the join rows and the
 * NextAuth `Account` / `Session` rows all cascade from `User`. R2 is not in that cascade and is
 * swept separately, or "delete my account" would leave every uploaded file in the bucket with
 * nothing pointing at it.
 *
 * Refused while a subscription would still bill. Cancelling and deleting are two separate controls:
 * the row holding `stripeCustomerId` is the only pointer to the subscription, so deleting it first
 * would leave a card being charged for an account that no longer exists and nothing in the system
 * able to find it. The application does not end a paid subscription on someone's behalf — the person
 * who bought it ends it in Stripe's own UI.
 *
 * @remarks
 * Nothing invalidates a JWT held elsewhere, and nothing needs to: the row is gone, so
 * `getCurrentUser` throws for any surviving token and every authenticated read fails closed.
 */
export async function deleteAccount(
    _previous: AccountActionState,
    formData: FormData,
): Promise<AccountActionState> {
    const user = await getCurrentUser();

    // Re-checked on the server even though the dialog will not enable its button until the typed
    // value matches. The typed confirmation exists to make the action deliberate, and a guard that
    // lives only in component state is not a guard — a double submit, a replayed action call, or a
    // browser that never ran the client bundle would all walk past it.
    //
    // Compared case-insensitively: the address is echoed on screen to be copied, GitHub can supply a
    // mixed-case one, and the point is to prove intent rather than spelling.
    const confirmation = String(formData.get("confirmation") ?? "").trim();

    if (confirmation.toLowerCase() !== user.email.toLowerCase()) {
        return {
            error: null,
            fields: { confirmation: "The email address doesn't match." },
        };
    }

    // Asked of Stripe rather than of `user.isPro`: `isPro` is only as current as the last webhook
    // that landed, so a missed delivery leaves the row saying "free" for an account Stripe is still
    // billing — which is the case this gate exists to catch.
    //
    // Refused rather than cancelled on the user's behalf. The account is still here afterwards, so
    // this is a route to the portal rather than a dead end, and the dialog offers that route.
    if (await hasBillableSubscription(user.id)) {
        return {
            error: "You still have an active Pro subscription. Cancel it first — the button is in Settings → Billing — and then you can delete your account.",
        };
    }

    try {
        // Best-effort, and not load-bearing: the gate above has established that nothing is going to
        // bill this customer, so a failure here costs no money. A Stripe outage must not stop
        // someone leaving.
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

    // *After* the row, unlike the Stripe cleanup, and for the opposite reason: the cascade destroys
    // nothing R2 needs — objects are keyed by user id, so the prefix outlives every row. Sweeping
    // first would mean a failed `user.delete` had just destroyed a live account's files, which is
    // worse than an orphan. This is `deleteItem`'s trade at account scale.
    //
    // Best-effort and outside the try, like the item path: the account is already gone and the
    // user's request succeeded, so a briefly unreachable bucket is not something to report or roll
    // back. The leftover objects are what a scheduled prefix sweep is for.
    try {
        await deleteUserObjects(user.id);
    } catch (error) {
        console.error(`Orphaned R2 objects after deleting account ${user.id}:`, error);
    }

    // Outside the try: `signOut` leaves by throwing NEXT_REDIRECT, which the catch above would
    // swallow — reporting a failure for a deletion that has already succeeded.
    //
    // `/sign-in`, where ordinary sign-out goes to the marketing page: the sign-in page is what reads
    // `deleted=1` and confirms the account is gone.
    await signOut({ redirectTo: "/sign-in?deleted=1" });

    return EMPTY_ACCOUNT_STATE;
}
