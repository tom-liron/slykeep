/**
 * Human messages for the `error` query param Auth.js appends when a sign-in fails.
 *
 * These arrive on `/sign-in` rather than a dedicated error page because `SignInError.kind` is
 * `"signIn"`, and `@auth/core` resolves its redirect target from `pages[kind]` — so every failure
 * below lands on the page named by `pages.signIn` in `auth.config.ts`.
 *
 * Only the codes `@auth/core` considers client-safe can appear verbatim; everything else it reports
 * as `Configuration`. Unmapped codes fall back to a generic message, so a raw error type is never
 * rendered to a user.
 */
/**
 * `code` carried by the `CredentialsSignin` subclass `authorize` throws for an unconfirmed address.
 *
 * Lives in this module — which imports nothing — so that `src/auth.ts` and the sign-in action can
 * agree on the string without the action pulling in a server-only module, and without the constant
 * being duplicated in two places that could drift apart silently.
 */
export const EMAIL_UNVERIFIED_CODE = "email_unverified";

/** What the sign-in form shows when the password was right but the address is unconfirmed. */
export const EMAIL_UNVERIFIED_MESSAGE =
    "Confirm your email address before signing in. Check your inbox for the link we sent.";

/**
 * `code` carried by the `CredentialsSignin` subclass `authorize` throws once the sign-in limit for
 * this address and address block is spent. Here beside the other for the same reason.
 */
export const RATE_LIMITED_CODE = "rate_limited";

/**
 * What a throttled sign-in shows.
 *
 * Vaguer about the wait than the JSON routes are, and it has to be: `code` is the only field Auth.js
 * carries out of `authorize`, so the minutes the limiter reported cannot travel with it. Encoding a
 * number into the code would put it in the `?code=` of a redirect URL for a saving of one word.
 *
 * Says nothing about which of the address or the password was wrong, matching every other credentials
 * failure — a message that appeared only for registered addresses would be an enumeration oracle
 * built out of the defence against enumeration.
 */
export const RATE_LIMITED_MESSAGE =
    "Too many sign-in attempts. Wait a few minutes before trying again.";

const SIGN_IN_ERROR_MESSAGES: Record<string, string> = {
    // The one that motivated this module: GitHub returned an email that already belongs to a
    // password account. Naming the cause is safe here — reaching this error required
    // authenticating at GitHub as the owner of that address, so the only account it reveals is the
    // visitor's own. (The deliberately vague credentials failures in `actions/auth.ts` guard
    // against a different threat: an unauthenticated visitor probing for registered emails.)
    OAuthAccountNotLinked:
        "That email already has a DevStash account with a password. Sign in with your email and password below.",
    AccountNotLinked:
        "That email already has a DevStash account with a password. Sign in with your email and password below.",
    // The provider itself refused or returned an error response — retrying is the useful advice.
    OAuthCallbackError: "GitHub sign-in did not complete. Try again.",
    AccessDenied: "GitHub sign-in was cancelled or declined.",
    Verification: "That sign-in link has expired or was already used. Request a new one.",
    // Ours, not Auth.js's — set by the redirect out of `GET /api/auth/verify-email` when the token
    // could not be consumed. Both messages point at the resend control rather than dead-ending,
    // since the account exists in every case and only the link is spent.
    VerificationExpired:
        "That verification link has expired. Request a new one below and we will send a fresh link.",
    VerificationInvalid:
        "That verification link is not valid or has already been used. Request a new one below.",
    MissingCSRF: "Your session expired before sign-in finished. Try again.",
    // Also ours: set by `GET /api/auth/stale-session` after clearing a session whose account no
    // longer exists. Deliberately vague about *why* the account is gone — this fires for a deletion
    // from another device and for a re-seeded development database alike, and the honest answer
    // ("we can't find you any more") is the same either way.
    SessionUserMissing: "Your account is no longer available.",
    // Ours to fix, not the user's. Say so plainly instead of implying they did something wrong;
    // the real cause is in the server logs.
    Configuration: "Sign-in is temporarily unavailable. Please try again later.",
};

const FALLBACK_MESSAGE = "Something went wrong signing you in. Try again.";

/**
 * Resolves a sign-in error code to a message, or `null` when there is no error to report.
 *
 * Takes `string | string[] | undefined` because that is what Next hands back from `searchParams`: a
 * duplicated param (`?error=a&error=b`) arrives as an array. Only a single value is meaningful, so
 * anything else is treated as an unrecognized failure rather than ignored — the whole point of this
 * module is that a failed sign-in never renders a clean form.
 */
export function getSignInErrorMessage(code: string | string[] | undefined): string | null {
    if (code === undefined) return null;
    if (typeof code !== "string") return FALLBACK_MESSAGE;

    // `?error=` with no value is a hand-edited URL, not a failure — Auth.js always sets a type.
    if (code.trim() === "") return null;

    return SIGN_IN_ERROR_MESSAGES[code] ?? FALLBACK_MESSAGE;
}
