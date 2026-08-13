"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";

import { signOut } from "@/auth";
import { changePasswordSchema } from "@/lib/auth-schemas";
import { prisma } from "@/lib/prisma";
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
        const fields = z.flattenError(parsed.error).fieldErrors;

        return {
            error: null,
            fields: {
                currentPassword: fields.currentPassword?.[0],
                password: fields.password?.[0],
                confirmPassword: fields.confirmPassword?.[0],
            },
        };
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
 * One `delete` is the whole operation: items, collections, their join rows, and the NextAuth
 * `Account` / `Session` rows all cascade from `User` (see the schema's `onDelete: Cascade`). Tag
 * rows are global and have no owner, so they are left behind by design rather than by oversight.
 *
 * Nothing invalidates a JWT held elsewhere, but nothing needs to: the row is gone, so
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

    try {
        await prisma.user.delete({ where: { id: user.id } });
    } catch (error) {
        console.error("Account deletion failed:", error);

        return { error: "Could not delete your account. Try again." };
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
