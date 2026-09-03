import "server-only";

import bcrypt from "bcryptjs";

/**
 * The application's password-hashing parameters, and the only supported way to produce a hash.
 *
 * Three paths write a password — registration in `api/auth/register`, the reset route, and
 * `changePassword` in `actions/account.ts` — and one path verifies it, the credentials `authorize`
 * in `auth.ts`. All four go through this module so the cost factor and the timing decoy stay one
 * pair of values rather than four copies.
 *
 * @remarks
 * `server-only` rather than `lib/`: `lib/` is client-reachable in this project, and nothing about
 * password hashing may be able to follow an import into a browser bundle.
 */

/**
 * The bcrypt cost factor every hash in the application is produced at.
 *
 * @remarks
 * Correct only together with {@link ABSENT_USER_HASH}, which is precomputed at this factor. Raising
 * it without regenerating that hash reopens the timing gap the decoy closes.
 */
export const PASSWORD_HASH_ROUNDS = 12;

/**
 * A real bcrypt hash of a random string nothing knows, compared against when no account matches, so
 * that a miss spends the same time hashing as a hit.
 *
 * @remarks
 * Returning early on a missing account leaks which addresses are registered: the miss answers in
 * roughly 70ms and the hit in roughly 550ms, which is a stopwatch away from an account list.
 * Regenerate this at {@link PASSWORD_HASH_ROUNDS} if that factor changes — a mismatch is invisible
 * to the test suite and reopens the leak.
 */
export const ABSENT_USER_HASH = "$2b$12$1AOauVh.zv9Unpj6DzfsTumooYhJ3avF0tY1bvv.MnB0TqU9uu4Yq";

/** Hashes a new password at {@link PASSWORD_HASH_ROUNDS}. The only supported way to produce one. */
export function hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, PASSWORD_HASH_ROUNDS);
}
