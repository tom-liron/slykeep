import "server-only";

import { Prisma } from "@/generated/prisma-client/client";

/** Prisma's "no record matched the `where`" code, raised by `update` and `delete`. */
const RECORD_NOT_FOUND = "P2025";

/**
 * Whether a caught error is Prisma's "no record matched the `where`" — the one failure every scoped
 * write has to tell apart from a real one.
 *
 * This predicate is what turns `where: { id, userId }` into an answer that keeps a row belonging to
 * someone else indistinguishable from one that does not exist: both miss the `where`, both raise
 * this code, and both are reported as "no longer exists". Get the narrowing wrong and the write
 * falls through to the generic arm instead, which logs and answers "could not save" — a stranger's
 * id and a deleted one would then produce different messages, which is exactly the thing the `where`
 * exists to prevent.
 *
 * It lives in `server/` rather than `lib/` because it imports the `Prisma` namespace to reach
 * `PrismaClientKnownRequestError`, and `lib/` is client-reachable. It lives outside `actions/`
 * because a `"use server"` module may only export async functions, so the two action files that need
 * it could not otherwise share it — `actions/collections.ts` carried a restated copy of the constant
 * and a comment explaining that it had to.
 */
export function isRecordNotFound(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === RECORD_NOT_FOUND;
}
