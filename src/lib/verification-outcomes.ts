/**
 * The vocabulary the verification link and its result page share.
 *
 * `verifyEmailToken` in `server/verification.ts` decides how a click ended, `GET
 * /api/auth/verify-email` puts that name in the `status` param of its redirect, and the
 * `/verify-email` page turns it back into a message. The union lives here rather than beside the
 * token logic so the page — and anything else client-reachable — can name an outcome without
 * pulling in a `server-only` module.
 *
 * This module imports nothing, which is what lets the edge proxy's route lists and the page share
 * it freely.
 */

/** How a verification click ended. The route handler emits these names verbatim as `?status=`. */
export type VerificationOutcome = "verified" | "already-verified" | "expired" | "invalid";

const OUTCOMES: readonly VerificationOutcome[] = [
    "verified",
    "already-verified",
    "expired",
    "invalid",
];

/**
 * Reads the outcome the `/verify-email` page was redirected with.
 *
 * @param raw - the `status` param as Next hands it back from `searchParams`: a string, `undefined`
 * when the page was opened directly, or an array when the param is duplicated.
 *
 * @returns the outcome named, and `"invalid"` for everything else. The param is attacker-supplied
 * and chooses only which sentence is rendered — the account state it reports was already applied by
 * the route handler — so an unrecognized value reads as a dead link rather than an error.
 */
export function parseVerificationOutcome(
    raw: string | string[] | undefined | null,
): VerificationOutcome {
    if (typeof raw !== "string") return "invalid";

    return OUTCOMES.find((outcome) => outcome === raw) ?? "invalid";
}
