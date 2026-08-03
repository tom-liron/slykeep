import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { prisma } from "@/lib/prisma";
import {
    emailFrom,
    identifierFor,
    IDENTIFIER_PREFIX,
    type TokenPurpose,
} from "./token-identifiers";

/**
 * Single-use email tokens — address confirmation and password reset — both stored in the
 * `VerificationToken` table NextAuth already defines.
 *
 * Reusing that table rather than adding one is safe because nothing else writes to it: the email
 * provider is not configured, so verification tokens for magic links never exist.
 *
 * `identifier` holds the address the token was issued for, prefixed with its purpose. That prefix is
 * the only thing keeping the two kinds of token apart, and it is load-bearing in both directions:
 * the table has no purpose column, and a token is looked up by its digest alone, so without it a
 * reset link handed to the verification route would be spent confirming an address, and — far worse
 * — a *verification* token posted to the reset route would let anyone who can receive that email set
 * a password on the account. Every read and delete below is scoped to one prefix for that reason.
 *
 * Both purposes carry an explicit prefix, including the one that predates this. Letting a purpose be
 * "the absence of a prefix" would mean each new kind of token has to be excluded from it by name,
 * and the failure mode of forgetting is silent cross-purpose acceptance — exactly the bug the prefix
 * exists to prevent. The cost is that verification links already in flight when this shipped no
 * longer match; they read as invalid, and `/sign-in` already offers a resend control for that.
 */

/**
 * How long a link stays good.
 *
 * Confirmation gets a day — long enough to survive a slow inbox, short enough to expire. A reset
 * token is a live credential that replaces a password, so it gets an hour: the user asked for it
 * seconds ago and is waiting on it, and every extra hour is more time for a forwarded or leaked
 * mailbox to be worth something.
 */
const TOKEN_TTL_MS: Record<TokenPurpose, number> = {
    "email-verification": 24 * 60 * 60 * 1000,
    "password-reset": 60 * 60 * 1000,
};

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
 * Issues a fresh token of one purpose for an address and returns the raw value to email.
 *
 * Any token previously issued for the *same purpose and address* is deleted first: a resend must
 * invalidate the earlier link, or every request permanently widens the set of URLs that can act on
 * the account. Scoping that delete to the prefix is what stops a reset request from silently killing
 * a pending confirmation link, and the other way around.
 */
async function issueToken(purpose: TokenPurpose, email: string): Promise<string> {
    const token = generateToken();
    const identifier = identifierFor(purpose, email);

    await prisma.$transaction([
        prisma.verificationToken.deleteMany({ where: { identifier } }),
        prisma.verificationToken.create({
            data: {
                identifier,
                token: hashToken(token),
                expires: new Date(Date.now() + TOKEN_TTL_MS[purpose]),
            },
        }),
    ]);

    return token;
}

/**
 * Looks up a raw token, without consuming it, and refuses to return one issued for another purpose.
 *
 * A digest that exists under the wrong prefix is reported exactly like one that does not exist at
 * all, and is deliberately left in place — it is still a valid token for whatever it *was* issued
 * for, and deleting it here would let either route be used to cancel the other's links.
 */
async function findToken(purpose: TokenPurpose, token: string) {
    if (!token) return null;

    const record = await prisma.verificationToken.findUnique({
        where: { token: hashToken(token) },
    });

    if (!record?.identifier.startsWith(IDENTIFIER_PREFIX[purpose])) return null;

    return record;
}

/**
 * Deletes a row that has already been found, and reports whether *this* caller is the one that
 * deleted it.
 *
 * `deleteMany`, not `delete`. Two requests can arrive together for the same link — a mail client or
 * scanner prefetching the URL alongside the person clicking it — and both will have found the row.
 * `delete` throws `P2025` when the row is already gone, which would turn a harmless race into a 500
 * on a route users reach straight from their inbox. The count doubles as the race winner: exactly
 * one caller can observe `1`.
 */
async function consumeRow(tokenDigest: string) {
    const { count } = await prisma.verificationToken.deleteMany({ where: { token: tokenDigest } });

    return count > 0;
}

/* -------------------------------------------------------------------------- */
/*  Email verification                                                        */
/* -------------------------------------------------------------------------- */

export function createVerificationToken(email: string): Promise<string> {
    return issueToken("email-verification", email);
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
    const record = await findToken("email-verification", token);

    if (!record) return { status: "invalid" };

    const email = emailFrom("email-verification", record.identifier);
    const consumed = await consumeRow(record.token);

    if (record.expires < new Date()) return { status: "expired" };

    // Lost the race. The other request already applied the effect, so report the account as it now
    // stands rather than calling a link invalid when it demonstrably worked.
    if (!consumed) return describeAccount(email);

    // `updateMany` rather than `update`: the account may have been deleted between the email being
    // sent and the link being clicked, and a missing row should read as a dead link, not throw.
    const { count } = await prisma.user.updateMany({
        where: { email, emailVerified: null },
        data: { emailVerified: new Date() },
    });

    if (count > 0) return { status: "verified", email };

    return describeAccount(email);
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

/* -------------------------------------------------------------------------- */
/*  Password reset                                                            */
/* -------------------------------------------------------------------------- */

export function createPasswordResetToken(email: string): Promise<string> {
    return issueToken("password-reset", email);
}

export type PasswordResetTokenState = "valid" | "expired" | "invalid";

/**
 * Reports whether a reset link is still usable, **without** consuming it.
 *
 * The reset page runs this before rendering, so a dead link says so up front instead of after
 * someone has chosen and confirmed a new password. It has to be side-effect free for that: the
 * token still has to work when the form it just rendered is submitted.
 */
export async function checkPasswordResetToken(token: string): Promise<PasswordResetTokenState> {
    const record = await findToken("password-reset", token);

    if (!record) return "invalid";

    return record.expires < new Date() ? "expired" : "valid";
}

export type PasswordResetResult =
    { status: "valid"; email: string } | { status: "expired" } | { status: "invalid" };

/**
 * Spends a reset token and returns the address it was issued for.
 *
 * Consuming is separated from writing the password so the caller can hash — which is deliberately
 * slow — outside the window where the token is still live, and so this module never needs to know
 * what a password is. The token is gone either way once this returns a status other than `invalid`:
 * an expired link is spent rather than left for a second attempt, matching verification.
 *
 * The race that matters here is two submissions of the same link. Only one can observe the delete,
 * and the loser is told the link is invalid rather than being allowed to overwrite the password the
 * winner just set.
 */
export async function consumePasswordResetToken(token: string): Promise<PasswordResetResult> {
    const record = await findToken("password-reset", token);

    if (!record) return { status: "invalid" };

    const consumed = await consumeRow(record.token);

    if (record.expires < new Date()) return { status: "expired" };
    if (!consumed) return { status: "invalid" };

    return { status: "valid", email: emailFrom("password-reset", record.identifier) };
}
