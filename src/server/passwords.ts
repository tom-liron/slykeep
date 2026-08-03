import "server-only";

import bcrypt from "bcryptjs";

/**
 * The one place the app's bcrypt cost factor is defined, and the decoy hash pinned to it.
 *
 * These two values are only correct *together*, which is why they now live in one file. Every hash
 * the app writes — registration, password reset, a change from the profile page — must be produced
 * at the same factor as `ABSENT_USER_HASH` is precomputed at, or the sign-in timing gap that hash
 * exists to close reopens. Three copies of the constant, each with a comment naming the other two,
 * was a drift waiting to happen.
 *
 * `server-only` rather than `lib/`: `lib/` is client-reachable in this project, and nothing about
 * password hashing should ever be able to follow an import into a browser bundle.
 */
export const PASSWORD_HASH_ROUNDS = 12;

/**
 * A real bcrypt hash of a random string that nothing knows, compared against when no account
 * matches. Its only job is to burn the same ~500ms the genuine path spends hashing.
 *
 * Returning early on a missing account leaks which emails are registered: the miss answers in
 * ~70ms and the hit in ~550ms, which is a stopwatch away from an account list. Regenerate it if
 * `PASSWORD_HASH_ROUNDS` ever changes — a mismatch is invisible in tests and reopens the leak.
 */
export const ABSENT_USER_HASH = "$2b$12$1AOauVh.zv9Unpj6DzfsTumooYhJ3avF0tY1bvv.MnB0TqU9uu4Yq";

/** Hashes a new password at the app's cost factor. The only supported way to produce one. */
export function hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, PASSWORD_HASH_ROUNDS);
}
