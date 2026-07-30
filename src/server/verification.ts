import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { prisma } from "@/lib/prisma";

/**
 * Email-verification tokens, stored in the `VerificationToken` table NextAuth already defines.
 *
 * Reusing that table rather than adding one is safe because nothing else writes to it: the email
 * provider is not configured, so verification tokens for magic links never exist. `identifier` holds
 * the email address the token was issued for.
 */

/** How long a link stays good. Long enough to survive a slow inbox, short enough to expire. */
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

/** 32 bytes of CSPRNG output, base64url-encoded. Guessing is not a threat model at this size. */
function generateToken() {
    return randomBytes(32).toString("base64url");
}

/**
 * What actually goes in the database.
 *
 * The raw token travels in the email link; only its digest is stored, so a leaked database dump — or
 * anyone with read access to the table — cannot turn rows back into working links. Plain SHA-256 is
 * the right primitive here, unlike for passwords: the input is 256 bits of randomness, so there is
 * no dictionary to attack and nothing for a slow KDF to protect.
 */
function hashToken(token: string) {
    return createHash("sha256").update(token).digest("hex");
}

/**
 * Issues a fresh verification token for an address and returns the raw value to email.
 *
 * Any token previously issued to the same address is deleted first: a resend must invalidate the
 * earlier link, or every request permanently widens the set of URLs that can verify the account.
 */
export async function createVerificationToken(email: string): Promise<string> {
    const token = generateToken();

    await prisma.$transaction([
        prisma.verificationToken.deleteMany({ where: { identifier: email } }),
        prisma.verificationToken.create({
            data: {
                identifier: email,
                token: hashToken(token),
                expires: new Date(Date.now() + TOKEN_TTL_MS),
            },
        }),
    ]);

    return token;
}

/** Why a token could not be used, for a caller that has to explain itself to a person. */
export type VerificationResult =
    | { status: "verified"; email: string }
    | { status: "already-verified"; email: string }
    | { status: "expired" }
    | { status: "invalid" };

/**
 * Consumes a raw token from a verification link and marks its user verified.
 *
 * The row is deleted on every outcome that found one, expiry included — a single-use link stays
 * single-use even when the click comes too late, and an expired row has no further purpose. The
 * caller's remedy in that case is to issue a new one, not to retry this.
 */
export async function verifyEmailToken(token: string): Promise<VerificationResult> {
    if (!token) return { status: "invalid" };

    const record = await prisma.verificationToken.findUnique({
        where: { token: hashToken(token) },
    });

    if (!record) return { status: "invalid" };

    // `deleteMany`, not `delete`. Two requests can arrive together for the same link — a mail
    // client or scanner prefetching the URL alongside the person clicking it — and both will have
    // found the row above. `delete` throws `P2025` when the row is already gone, which would turn a
    // harmless race into a 500 on the one route users reach straight from their inbox.
    //
    // The count doubles as the race winner: exactly one caller can observe `1`.
    const { count: consumed } = await prisma.verificationToken.deleteMany({
        where: { token: record.token },
    });

    if (record.expires < new Date()) return { status: "expired" };

    // Lost the race. The other request already applied the effect, so report the account as it now
    // stands rather than calling a link invalid when it demonstrably worked.
    if (consumed === 0) return describeAccount(record.identifier);

    // `updateMany` rather than `update`: the account may have been deleted between the email being
    // sent and the link being clicked, and a missing row should read as a dead link, not throw.
    const { count } = await prisma.user.updateMany({
        where: { email: record.identifier, emailVerified: null },
        data: { emailVerified: new Date() },
    });

    if (count > 0) return { status: "verified", email: record.identifier };

    return describeAccount(record.identifier);
}

/**
 * Explains an address whose token was consumed without this call being the one that verified it.
 *
 * Either the account is already verified — a second click, or a lost race — or it is gone. The two
 * decide whether the page apologizes or simply sends them on to sign in.
 */
async function describeAccount(email: string): Promise<VerificationResult> {
    const user = await prisma.user.findUnique({
        where: { email },
        select: { emailVerified: true },
    });

    return user?.emailVerified ? { status: "already-verified", email } : { status: "invalid" };
}
