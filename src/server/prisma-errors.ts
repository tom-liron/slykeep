import "server-only";

import { Prisma } from "@/generated/prisma-client/client";

/**
 * The one Prisma error the write paths have to recognize, and the predicate that recognizes it.
 *
 * Every scoped write in `actions/` targets `where: { id, userId }` and has to tell "that row is not
 * yours or does not exist" apart from a genuine database failure. The two get different answers —
 * "no longer exists" versus "could not save" — and this is where the difference is decided.
 *
 * It lives in `server/` rather than `lib/` because it imports the `Prisma` namespace to reach
 * `PrismaClientKnownRequestError`, and `lib/` is client-reachable. It lives outside `actions/`
 * because a `"use server"` module may export only async functions, so the action files that share it
 * could not otherwise declare it.
 */

/** Prisma's "no record matched the `where`" code, raised by `update` and `delete`. */
const RECORD_NOT_FOUND = "P2025";

/**
 * Whether a caught error is Prisma's "no record matched the `where`".
 *
 * @remarks
 * This predicate is what keeps a row belonging to someone else indistinguishable from one that does
 * not exist: both miss the ownership `where`, both raise this code, and both are reported as "no
 * longer exists". A narrowing that fails here sends the write to the generic arm instead, which logs
 * and answers "could not save" — so a stranger's id and a deleted one would produce different
 * messages, which is what the ownership `where` exists to prevent.
 */
export function isRecordNotFound(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === RECORD_NOT_FOUND;
}
