/**
 * Client-safe messages for the `error` code Auth.js appends to `/sign-in` when a sign-in fails.
 *
 * Failures land on `/sign-in` rather than a dedicated error page because `SignInError.kind` is
 * `"signIn"` and `@auth/core` resolves its redirect from `pages[kind]`. Only the codes `@auth/core`
 * considers client-safe arrive verbatim; everything else it reports as `Configuration`. The sign-in
 * page calls {@link getSignInErrorMessage} to turn a code into a sentence, and `src/auth.ts` and
 * the sign-in action import the `*_CODE` constants so the three agree on the strings without the
 * action pulling in a server-only module.
 *
 * This module imports nothing, which is what lets those consumers share it freely.
 */

/** The `code` `authorize` throws once the sign-in limit for this address and address block is spent. */
export const RATE_LIMITED_CODE = "rate_limited";

/**
 * What a throttled sign-in shows.
 *
 * @remarks
 * Vaguer about the wait than the JSON routes, because `code` is the only field Auth.js carries out
 * of `authorize` — the minutes the limiter reported cannot travel with it. It names neither the
 * address nor the password as wrong, matching every other credentials failure: a message that
 * appeared only for registered addresses would be an enumeration oracle.
 */
export const RATE_LIMITED_MESSAGE =
    "Too many sign-in attempts. Wait a few minutes before trying again.";

const SIGN_IN_ERROR_MESSAGES: Record<string, string> = {
    // GitHub returned an email that already belongs to a password account. Naming the cause is safe
    // here — reaching this required authenticating at GitHub as the owner of that address, so the
    // only account it reveals is the visitor's own. The vague credentials failures in
    // `actions/auth.ts` guard a different threat: an unauthenticated visitor probing for registered
    // emails.
    OAuthAccountNotLinked:
        "That email already has a SlyKeep account with a password. Sign in with your email and password below.",
    AccountNotLinked:
        "That email already has a SlyKeep account with a password. Sign in with your email and password below.",
    // The provider itself refused or returned an error response — retrying is the useful advice.
    OAuthCallbackError: "GitHub sign-in did not complete. Try again.",
    AccessDenied: "GitHub sign-in was cancelled or declined.",
    Verification: "That sign-in link has expired or was already used. Request a new one.",
    MissingCSRF: "Your session expired before sign-in finished. Try again.",
    // Set by `GET /api/auth/stale-session` after clearing a session whose account no longer exists.
    // Vague about why the account is gone: this fires for a deletion from another device and for a
    // re-seeded development database alike, and the honest answer is the same either way.
    SessionUserMissing: "Your account is no longer available.",
    // A server-side misconfiguration, not something the user did. The real cause is in the logs.
    Configuration: "Sign-in is temporarily unavailable. Please try again later.",
};

const FALLBACK_MESSAGE = "Something went wrong signing you in. Try again.";

/**
 * Resolves a sign-in error code to a message, or `null` when there is no error to report.
 *
 * @param code - the `?error=` value as Next hands it back from `searchParams`: a string, `undefined`
 * when absent, or an array when the param is duplicated. An array is treated as an unrecognized
 * failure rather than ignored, so a failed sign-in never renders a clean form.
 */
export function getSignInErrorMessage(code: string | string[] | undefined): string | null {
    if (code === undefined) return null;
    if (typeof code !== "string") return FALLBACK_MESSAGE;

    // `?error=` with no value is a hand-edited URL, not a failure — Auth.js always sets a type.
    if (code.trim() === "") return null;

    return SIGN_IN_ERROR_MESSAGES[code] ?? FALLBACK_MESSAGE;
}
