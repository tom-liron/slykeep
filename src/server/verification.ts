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
 * Single-use email tokens: address confirmation and password reset.
 *
 * The security core of both out-of-band email flows. `api/auth/register` and the resend control
 * issue a confirmation token, `api/auth/forgot-password` issues a reset token, and
 * `api/auth/verify-email` and `api/auth/reset-password` spend them. Nothing outside this module
 * reads the token table; callers hand in a raw token and get back a status.
 *
 * Both kinds live in the `VerificationToken` table NextAuth already defines, which is safe because
 * nothing else writes to it — the email provider is not configured, so magic-link tokens never
 * exist.
 *
 * @remarks
 * The table has no purpose column and a token is found by its digest alone, so the prefix on
 * `identifier` is the only thing keeping the two kinds apart, in both directions: without it a reset
 * link handed to the verification route would be spent confirming an address, and — far worse — a
 * *verification* token posted to the reset route would let anyone who can receive that email set a
 * password on the account. Every read and delete below is scoped to one prefix for that reason.
 *
 * Both purposes carry an explicit prefix. A purpose that is "the absence of a prefix" would have to
 * exclude each new kind of token by name, and forgetting is silent cross-purpose acceptance.
 *
 * @see {@link IDENTIFIER_PREFIX} in `./token-identifiers`, which the maintenance scripts share.
 */

/**
 * How long a link of each purpose stays good.
 *
 * @remarks
 * Confirmation gets a day — long enough to survive a slow inbox, short enough to expire. A reset
 * token is a live credential that replaces a password, so it gets an hour: the user asked for it
 * seconds ago and is waiting on it, and every extra hour is more time in which a forwarded or leaked
 * mailbox is worth something.
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
 * The raw token travels in the email link and only its digest is stored, so a database dump — or
 * anyone with read access to the table — cannot turn rows back into working links.
 *
 * @remarks
 * Plain SHA-256 is the right primitive here, unlike for passwords: the input is 256 bits of
 * randomness, so there is no dictionary to attack and nothing for a slow KDF to protect.
 */
function hashToken(token: string) {
    return createHash("sha256").update(token).digest("hex");
}

/**
 * Issues a fresh token of one purpose for an address and returns the raw value to email.
 *
 * @remarks
 * Any token previously issued for the same purpose *and* address is deleted first: a resend has to
 * invalidate the earlier link, or every request permanently widens the set of URLs that can act on
 * the account. Scoping that delete to the prefix is what stops a reset request from killing a
 * pending confirmation link, and the reverse.
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
 * Looks up a raw token without consuming it, and refuses to return one issued for another purpose.
 *
 * @remarks
 * A digest that exists under the wrong prefix is reported exactly like one that does not exist, and
 * is left in place: it is still a valid token for whatever it *was* issued for, and deleting it here
 * would let either route cancel the other's links.
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
 * @remarks
 * `deleteMany`, not `delete`. Two requests can arrive together for one link — a mail client or
 * scanner prefetching the URL alongside the person clicking it — and both will have found the row.
 * `delete` throws `P2025` once the row is gone, turning a harmless race into a 500 on a route users
 * reach straight from their inbox. The count doubles as the race result: exactly one caller can
 * observe `1`.
 */
async function consumeRow(tokenDigest: string) {
    const { count } = await prisma.verificationToken.deleteMany({ where: { token: tokenDigest } });

    return count > 0;
}

/* -------------------------------------------------------------------------- */
/*  Email verification                                                        */
/* -------------------------------------------------------------------------- */

/** Issues a confirmation token for an address and returns the raw value to put in the email link. */
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
 * @remarks
 * The row is deleted on every outcome that found one, expiry included: a single-use link stays
 * single-use even when the click comes too late, and an expired row has no further purpose. The
 * caller's remedy is to issue a new token, not to retry this.
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
 * decide whether the page apologizes or sends the visitor on to sign in.
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

/** Issues a reset token for an address and returns the raw value to put in the email link. */
export function createPasswordResetToken(email: string): Promise<string> {
    return issueToken("password-reset", email);
}

export type PasswordResetTokenState = "valid" | "expired" | "invalid";

/**
 * Reports whether a reset link is still usable, **without** consuming it.
 *
 * The reset page runs this before rendering, so a dead link says so up front rather than after
 * someone has chosen and confirmed a new password.
 *
 * @remarks
 * It has to stay side-effect free: the token must still work when the form it just rendered is
 * submitted.
 */
export async function checkPasswordResetToken(token: string): Promise<PasswordResetTokenState> {
    const record = await findToken("password-reset", token);

    if (!record) return "invalid";

    return record.expires < new Date() ? "expired" : "valid";
}

export type PasswordResetResult =
    { status: "valid"; email: string } | { status: "expired" } | { status: "invalid" };

/**
 * Spends a reset token and returns the address it was issued for, leaving the caller to write the
 * new password.
 *
 * @remarks
 * Consuming is separated from writing so the caller can hash — which is slow by design — outside the
 * window in which the token is still live, and so this module never has to know what a password is.
 * The token is gone either way once this returns a status other than `invalid`: an expired link is
 * spent rather than left for a second attempt, matching verification.
 *
 * The race that matters is two submissions of one link. Only one can observe the delete, and the
 * loser is told the link is invalid rather than being allowed to overwrite the password the winner
 * just set.
 */
export async function consumePasswordResetToken(token: string): Promise<PasswordResetResult> {
    const record = await findToken("password-reset", token);

    if (!record) return { status: "invalid" };

    const consumed = await consumeRow(record.token);

    if (record.expires < new Date()) return { status: "expired" };
    if (!consumed) return { status: "invalid" };

    return { status: "valid", email: emailFrom("password-reset", record.identifier) };
}
