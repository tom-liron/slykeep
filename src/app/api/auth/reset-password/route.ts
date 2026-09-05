import { NextResponse } from "next/server";
import { z } from "zod";

import { resetPasswordSchema } from "@/lib/auth-schemas";
import { prisma } from "@/server/infra/prisma";
import { checkRateLimit, clientIp, tooManyRequests } from "@/server/infra/rate-limit";
import { hashPassword } from "@/server/passwords";
import { checkPasswordResetToken, consumePasswordResetToken } from "@/server/verification";

/**
 * Sets a new password from a reset link.
 *
 * @remarks
 * This route reports the specific failure — expired link, invalid link — where `forgot-password`
 * stays uniform. It can: the caller is identified by a 256-bit token received by email, not an
 * address anyone can type, so a specific answer discloses nothing guessable. Those failures are
 * also the only ones a user can act on, and a generic error would leave them retrying a form that
 * can never succeed.
 */

/** User-facing responses for reset tokens that cannot be used. */
const TOKEN_ERRORS = {
    expired: "That reset link has expired. Request a new one to try again.",
    invalid: "That reset link is not valid or has already been used. Request a new one.",
} as const;

export async function POST(request: Request) {
    // Keyed by IP with no token in the key, which is the only way round that works: a key that
    // included the token would give an attacker a fresh budget per guess, and guessing tokens is the
    // attack. Five attempts per quarter hour is ample for a person who mistyped a password twice.
    const limit = await checkRateLimit("resetPassword", await clientIp());

    if (!limit.success) return tooManyRequests(limit);

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
        // caller could otherwise spend by posting garbage. The limit above now caps that too, but
        // this ordering is still the cheaper of the two defences and the one that holds when the
        // limiter is failing open. Consuming *after* the hash then keeps the token alive across the
        // slow part, so a failure while hashing does not spend a link that was never used.
        const state = await checkPasswordResetToken(token);

        if (state !== "valid") {
            return NextResponse.json({ error: TOKEN_ERRORS[state], code: state }, { status: 400 });
        }

        const hash = await hashPassword(password);
        const consumed = await consumePasswordResetToken(token);

        if (consumed.status !== "valid") {
            return NextResponse.json(
                { error: TOKEN_ERRORS[consumed.status], code: consumed.status },
                { status: 400 },
            );
        }

        // Two statements. The second is conditional on `emailVerified: null` so it cannot move an
        // old, genuine confirmation date to today. Verifying here is the same proof by another
        // route — receiving this link demonstrates control of the inbox — so an account that never
        // confirmed can still finish a reset and sign in, rather than hitting a dead end at
        // `authorize` with a correct password.
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
