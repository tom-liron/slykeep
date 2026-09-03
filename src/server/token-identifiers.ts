/**
 * How a `VerificationToken` row records what its token is *for*.
 *
 * The table has no purpose column and a token is looked up by its digest alone, so the prefix on
 * `identifier` is the only thing keeping address-confirmation tokens and password-reset tokens
 * apart. `verification.ts` issues, finds and spends every token through these helpers.
 *
 * It is a separate module from `verification.ts` so the maintenance scripts can share it: that
 * module imports `server-only` and the Prisma singleton, neither of which a `tsx` script can pull
 * in, while this one is string handling with no imports and is reachable from anywhere.
 *
 * @remarks
 * The prefix has exactly one definition. A script holding a second copy drifts silently the moment
 * either changes, and a script deleting rows under a name nothing writes any more fails quietly.
 *
 * @see `verification.ts`, which states what the separation actually protects against.
 */

/** The two kinds of token the `VerificationToken` table holds. */
export type TokenPurpose = "email-verification" | "password-reset";

export const IDENTIFIER_PREFIX: Record<TokenPurpose, string> = {
    "email-verification": "email-verification:",
    "password-reset": "password-reset:",
};

/** The `identifier` a token of this purpose for this address is stored under. */
export function identifierFor(purpose: TokenPurpose, email: string) {
    return `${IDENTIFIER_PREFIX[purpose]}${email}`;
}

/** The address back out of an identifier. The caller has already matched the purpose's prefix. */
export function emailFrom(purpose: TokenPurpose, identifier: string) {
    return identifier.slice(IDENTIFIER_PREFIX[purpose].length);
}
