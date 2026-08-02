import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";

import { resetPasswordSchema } from "@/lib/auth-schemas";
import { prisma } from "@/lib/prisma";
import { checkPasswordResetToken, consumePasswordResetToken } from "@/server/verification";

/**
 * Sets a new password from a reset link.
 *
 * Unlike `forgot-password`, this one says exactly what went wrong. It can afford to: the caller is
 * identified by a 256-bit token they had to receive by email, not by an address anyone can type, so
 * a specific answer tells an attacker nothing they could have guessed their way into. The failures
 * it reports are also the only ones a user can act on — an expired link needs a new one, and a
 * generic error would leave them retrying a form that can never succeed.
 */

/**
 * Must match `PASSWORD_HASH_ROUNDS` in `app/api/auth/register/route.ts`, and `ABSENT_USER_HASH` in
 * `src/auth.ts` with it. A password reset that hashed at a different factor would make sign-in
 * measurably faster or slower for reset accounts than for registered ones — the timing leak the
 * decoy hash exists to close, reintroduced through the back door.
 */
const PASSWORD_HASH_ROUNDS = 12;

const TOKEN_ERRORS = {
    expired: "That reset link has expired. Request a new one to try again.",
    invalid: "That reset link is not valid or has already been used. Request a new one.",
} as const;

export async function POST(request: Request) {
    let body: unknown;

    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
    }

    const parsed = resetPasswordSchema.safeParse(body);

    if (!parsed.success) {
        return NextResponse.json(
            {
                error: "Invalid password.",
                fields: z.flattenError(parsed.error).fieldErrors,
            },
            { status: 400 },
        );
    }

    const { token, password } = parsed.data;

    try {
        // Checked before hashing, and consumed after. Rejecting a junk token up front keeps this
        // route from being an amplifier — bcrypt at cost 12 is ~500ms of CPU that an unauthenticated
        // caller could otherwise spend by posting garbage, on an endpoint with no rate limit.
        // Consuming *after* the hash then keeps the token alive across the slow part, so a failure
        // while hashing does not spend a link that was never used.
        const state = await checkPasswordResetToken(token);

        if (state !== "valid") {
            return NextResponse.json({ error: TOKEN_ERRORS[state], code: state }, { status: 400 });
        }

        const hash = await bcrypt.hash(password, PASSWORD_HASH_ROUNDS);
        const consumed = await consumePasswordResetToken(token);

        if (consumed.status !== "valid") {
            return NextResponse.json(
                { error: TOKEN_ERRORS[consumed.status], code: consumed.status },
                { status: 400 },
            );
        }

        // Two statements, because the second must not touch an account that was already confirmed:
        // stamping `emailVerified` unconditionally would move an old, genuine confirmation date to
        // today and quietly destroy the only record of when it happened.
        //
        // Verifying here at all is not a bonus, it is the same proof by a different route: receiving
        // this link demonstrates control of the inbox, which is exactly what the confirmation email
        // asks for. Without it, an account that never confirmed could complete a reset and still be
        // refused at sign-in by `authorize` — a dead end with a correct password.
        //
        // `updateMany` rather than `update`: the account may have been deleted between the email
        // being sent and this submission, and a missing row should read as a dead link, not throw.
        const [{ count }] = await prisma.$transaction([
            prisma.user.updateMany({
                where: { email: consumed.email },
                data: { password: hash },
            }),
            prisma.user.updateMany({
                where: { email: consumed.email, emailVerified: null },
                data: { emailVerified: new Date() },
            }),
        ]);

        if (count === 0) {
            return NextResponse.json(
                { error: TOKEN_ERRORS.invalid, code: "invalid" },
                { status: 400 },
            );
        }

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error("Password reset failed:", error);

        return NextResponse.json({ error: "Could not reset the password." }, { status: 500 });
    }
}
