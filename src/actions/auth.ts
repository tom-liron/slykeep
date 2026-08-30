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
 * Where a successful sign-in lands: the page the proxy bounced them off, or the dashboard.
 *
 * Not `/dashboard` in the default case — `(dashboard)` is a route group, so it contributes nothing
 * to the URL and the dashboard is served at the root.
 *
 * The `welcome` flag on that default is how a success toast survives: the redirect happens on the
 * server, so the form that would have raised the toast is gone by the time the user arrives.
 * `WelcomeToast` on the destination reads the flag and fires there instead. Only `back` remains —
 * the `new` variant existed for the register form signing a fresh account straight in, which email
 * verification removes.
 *
 * The callback comes from a form field rather than being read from the request, because a Server
 * Action has no access to the URL of the page that invoked it. Both forms carry it in a hidden
 * input; `resolveCallbackUrl` is what stops that field from pointing off-site.
 */
function destinationFrom(formData: FormData): string {
    return signInDestination(resolveCallbackUrl(formData.get("callbackUrl")?.toString()));
}

/**
 * Email/password sign-in.
 *
 * The single generic message is deliberate. `authorize` in `src/auth.ts` goes to some length to
 * make a wrong password, an unknown email, and an OAuth-only account indistinguishable — including
 * matching how long each takes. Reporting "no account with that email" here would hand back the
 * account list that work was meant to protect.
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
        // Name the field that is actually wrong. The old blanket "Enter your email and password"
        // fired on a malformed address too, which reads as "you left something blank" when both
        // boxes are visibly full — leaving no way to see that the address is missing its TLD.
        return { error: null, fields: fieldErrorsOf(parsed.error), email };
    }

    try {
        await signIn("credentials", { ...parsed.data, redirectTo: destinationFrom(formData) });
    } catch (error) {
        // A successful sign-in also leaves via `throw` — `redirectTo` raises NEXT_REDIRECT, which
        // Next needs to receive. Only genuine auth failures are ours to report; rethrow the rest or
        // the redirect is swallowed and the form silently does nothing.
        if (error instanceof AuthError) {
            // The one failure that is safe to name. Reaching it required a correct password, so the
            // account's existence is something the caller has already proven rather than something
            // this message reveals — and telling them anything else strands a user whose
            // credentials are perfectly good. Every other failure stays uniformly vague.
            if ("code" in error && error.code === EMAIL_UNVERIFIED_CODE) {
                return { error: EMAIL_UNVERIFIED_MESSAGE, unverified: true, email };
            }

            // The other failure worth naming, and safe for the opposite reason: it says nothing
            // about the account at all, only that this browser has been trying too often. Left
            // generic it would read as "your password is wrong" and invite the retries the limit is
            // there to stop. Thrown by `authorize` in `src/auth.ts`, which is where the counting
            // happens — see the note there on why not here.
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
 * Kicks off the GitHub OAuth handshake; the provider decides where the user goes next.
 *
 * `redirectTo` survives the round trip to GitHub — Auth.js stores it and applies it once its own
 * `/api/auth/callback/github` handler completes. That handler's URL is a separate thing configured
 * in the GitHub OAuth app and is not affected by any of this.
 */
export async function signInWithGitHub(formData: FormData) {
    await signIn("github", { redirectTo: destinationFrom(formData) });
}

/**
 * Clears the session and returns to the marketing homepage.
 *
 * This used to land on `/sign-in`, because `/` was the dashboard and nothing else — signing out
 * there would only have been bounced straight back by the proxy, so the redirect skipped the round
 * trip. Now the proxy serves the marketing page at `/` to anyone without a session, which makes it
 * the right destination on its own terms: it is the one page that still means something to someone
 * who has just deliberately stopped being a user, and sign-in is one click away on it.
 *
 * Account deletion deliberately does not follow — see `deleteAccount` in `actions/account.ts`.
 */
export async function signOutAction() {
    await signOut({ redirectTo: "/" });
}
