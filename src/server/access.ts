import "server-only";

import { getCurrentUser } from "./current-user";

/**
 * The one thing a confirmed email address is required for: writing.
 *
 * An unconfirmed account signs in, reads and copies everything it can see — including the starter
 * content registration seeds — but cannot create, edit or delete, and cannot reach checkout. The
 * restriction applies from the moment the account exists, so the first write is where a person
 * learns the address needs confirming.
 *
 * Every mutating Server Action calls {@link readOnlyRefusal} before it touches the database, and
 * `actions/billing.ts` calls it before starting a checkout session. The item and collection actions
 * call it ahead of parsing their input and looking up ownership: the refusal depends on the account
 * alone, so validating input the account may not write gains nothing.
 *
 * @remarks
 * It reads through `getCurrentUser`, which is wrapped in React's `cache`, so an action that also
 * reads the user for a Pro check pays for one row read rather than two. `emailVerified` comes from
 * the database row and never from the session token: the JWT is reissued on `updateAge` (24h), so a
 * token-borne flag would leave someone who confirmed on their phone blocked on their laptop for a
 * day.
 *
 * It returns `null` when the account may proceed, so a caller reads as
 * `const refusal = await readOnlyRefusal(); if (refusal) return { success: false, error: refusal };`
 * — one shape that fits every action's result type without this module having to know any of them.
 */

/**
 * Why an unconfirmed account may not write, or `null` when it may.
 *
 * @param action - what is being refused, folded into the sentence so it reads as a fact about the
 * thing the person just tried rather than as a generic denial.
 *
 * @remarks
 * Names the remedy rather than the rule. Nothing has been lost and nothing is locked away — the
 * account keeps everything it can see, and one click on the confirmation link lifts this — so the
 * message points at the link.
 */
export async function readOnlyRefusal(action = "save changes"): Promise<string | null> {
    const { emailVerified } = await getCurrentUser();

    if (emailVerified) return null;

    return `Confirm your email address to ${action}. Use the link we sent you, or request a new one from the banner at the top of the page.`;
}
