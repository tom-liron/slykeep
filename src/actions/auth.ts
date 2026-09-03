"use server";

import { AuthError } from "next-auth";

import { signIn, signOut } from "@/auth";
import {
    EMAIL_UNVERIFIED_CODE,
    EMAIL_UNVERIFIED_MESSAGE,
    RATE_LIMITED_CODE,
    RATE_LIMITED_MESSAGE,
} from "@/lib/auth-errors";
import { resolveCallbackUrl, signInDestination } from "@/lib/auth-redirects";
import { signInSchema } from "@/lib/auth-schemas";
import { fieldErrorsOf } from "@/lib/field-errors";
import { EMPTY_AUTH_STATE, type AuthActionState } from "@/types/auth";

/**
 * The sign-in and sign-out Server Actions.
 *
 * The boundary between the auth forms and NextAuth: `SignInForm` and the account menu call these,
 * which validate what was typed, hand it to `signIn` / `signOut` from `@/auth`, and turn a refusal
 * into a message the form can render. The credential check itself is not here — it is `authorize` in
 * `src/auth.ts`, which is also where the sign-in rate limit is spent.
 *
 * @remarks
 * Both sign-in paths leave by throwing: `redirectTo` raises `NEXT_REDIRECT`, which Next has to
 * receive. Only genuine `AuthError`s are caught and reported.
 */

/**
 * Where a successful sign-in lands: the page the proxy bounced the visitor off, or the dashboard.
 *
 * The dashboard is `/`, not `/dashboard` — `(dashboard)` is a route group and contributes nothing to
 * the URL.
 *
 * @remarks
 * The callback comes from a form field rather than from the request, because a Server Action has no
 * access to the URL of the page that invoked it. Both forms carry it in a hidden input, and
 * `resolveCallbackUrl` is what stops that field pointing off-site.
 *
 * The `welcome` flag on the default destination is how a success toast survives the redirect: it
 * happens on the server, so the form that would have raised the toast is gone by the time the user
 * arrives, and `WelcomeToast` on the destination fires it instead.
 */
function destinationFrom(formData: FormData): string {
    return signInDestination(resolveCallbackUrl(formData.get("callbackUrl")?.toString()));
}

/**
 * Email/password sign-in, driven by `SignInForm` through `useActionState`.
 *
 * @remarks
 * The single generic failure message is the point. `authorize` in `src/auth.ts` goes to some length
 * to make a wrong password, an unknown email and an OAuth-only account indistinguishable, including
 * in how long each takes; reporting "no account with that email" here would hand back the account
 * list that work protects. The two named failures below are the exceptions, and each is safe for its
 * own reason.
 */
export async function signInWithCredentials(
    _previous: AuthActionState,
    formData: FormData,
): Promise<AuthActionState> {
    // Kept raw for the round trip back to the form: whatever they typed is what should reappear in
    // the field, not the trimmed and lowercased version the schema produces.
    const email = String(formData.get("email") ?? "");

    const parsed = signInSchema.safeParse({ email, password: formData.get("password") });

    if (!parsed.success) {
        // Name the field that is wrong. A blanket "enter your email and password" fires on a
        // malformed address too, which reads as "you left something blank" when both boxes are
        // visibly full.
        return { error: null, fields: fieldErrorsOf(parsed.error), email };
    }

    try {
        await signIn("credentials", { ...parsed.data, redirectTo: destinationFrom(formData) });
    } catch (error) {
        // A successful sign-in also leaves via `throw` — `redirectTo` raises NEXT_REDIRECT, which
        // Next needs to receive. Only genuine auth failures are ours to report; rethrow the rest or
        // the redirect is swallowed and the form silently does nothing.
        if (error instanceof AuthError) {
            // Safe to name: reaching it required a correct password, so the account's existence is
            // something the caller has already proven rather than something this message reveals —
            // and anything vaguer strands a user whose credentials are perfectly good.
            if ("code" in error && error.code === EMAIL_UNVERIFIED_CODE) {
                return { error: EMAIL_UNVERIFIED_MESSAGE, unverified: true, email };
            }

            // Safe for the opposite reason: it says nothing about the account, only that this
            // browser has been trying too often. Left generic it would read as "your password is
            // wrong" and invite the retries the limit exists to stop.
            if ("code" in error && error.code === RATE_LIMITED_CODE) {
                return { error: RATE_LIMITED_MESSAGE, email };
            }

            return { error: "Invalid email or password.", email };
        }

        throw error;
    }

    return EMPTY_AUTH_STATE;
}

/**
 * Starts the GitHub OAuth handshake; the provider decides where the user goes next.
 *
 * @remarks
 * `redirectTo` survives the round trip to GitHub — Auth.js stores it and applies it once its own
 * `/api/auth/callback/github` handler completes. That handler's URL is configured in the GitHub
 * OAuth app and is unaffected by this.
 */
export async function signInWithGitHub(formData: FormData) {
    await signIn("github", { redirectTo: destinationFrom(formData) });
}

/**
 * Clears the session and returns to the marketing homepage.
 *
 * The proxy serves the marketing page at `/` to anyone without a session, so that is the one page
 * that still means something to someone who has just stopped being a user, and sign-in is one click
 * away on it.
 *
 * @remarks
 * Account deletion does not land here — `deleteAccount` in `actions/account.ts` signs out to
 * `/sign-in?deleted=1`, which is where the confirmation is shown.
 */
export async function signOutAction() {
    await signOut({ redirectTo: "/" });
}
