/**
 * How a `VerificationToken` row records what its token is *for*.
 *
 * Split out of `verification.ts` so the maintenance scripts can share it. That module imports
 * `server-only` and the Prisma singleton, which a `tsx` script cannot pull in; this one is pure
 * string handling with no imports, so it is safe to reach from anywhere. The prefix belongs in
 * exactly one place — a second copy in a script drifts silently the moment either changes, which is
 * how `scripts/verify-user.ts` came to be deleting rows that no longer existed under that name.
 *
 * See `verification.ts` for why the prefix is load-bearing rather than cosmetic.
 */

export type TokenPurpose = "email-verification" | "password-reset";

export const IDENTIFIER_PREFIX: Record<TokenPurpose, string> = {
    "email-verification": "email-verification:",
    "password-reset": "password-reset:",
};

export function identifierFor(purpose: TokenPurpose, email: string) {
    return `${IDENTIFIER_PREFIX[purpose]}${email}`;
}

export function emailFrom(purpose: TokenPurpose, identifier: string) {
    return identifier.slice(IDENTIFIER_PREFIX[purpose].length);
}
