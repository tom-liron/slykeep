"use server";

import { AuthError } from "next-auth";
import { z } from "zod";

import { signIn, signOut } from "@/auth";
import { signInSchema } from "@/lib/auth-schemas";
import { EMPTY_AUTH_STATE, type AuthActionState } from "@/types/auth";

/**
 * Where a successful sign-in lands. Not `/dashboard` — `(dashboard)` is a route group, so it
 * contributes nothing to the URL and the dashboard is served at the root.
 *
 * The `welcome` flag is how a success toast survives: the redirect happens on the server, so the
 * form that would have raised the toast is gone by the time the user arrives. `WelcomeToast` on the
 * destination reads the flag and fires there instead.
 */
const AFTER_SIGN_IN = (welcome: "new" | "back") => `/?welcome=${welcome}`;

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
        const fields = z.flattenError(parsed.error).fieldErrors;

        // Name the field that is actually wrong. The old blanket "Enter your email and password"
        // fired on a malformed address too, which reads as "you left something blank" when both
        // boxes are visibly full — leaving no way to see that the address is missing its TLD.
        return {
            error: null,
            fields: { email: fields.email?.[0], password: fields.password?.[0] },
            email,
        };
    }

    // Set by the register form when it signs a brand-new account in, so the toast on the other side
    // can say "account created" rather than "welcome back" to someone who has never been here.
    const welcome = formData.get("welcome") === "new" ? "new" : "back";

    try {
        await signIn("credentials", { ...parsed.data, redirectTo: AFTER_SIGN_IN(welcome) });
    } catch (error) {
        // A successful sign-in also leaves via `throw` — `redirectTo` raises NEXT_REDIRECT, which
        // Next needs to receive. Only genuine auth failures are ours to report; rethrow the rest or
        // the redirect is swallowed and the form silently does nothing.
        if (error instanceof AuthError) {
            return { error: "Invalid email or password.", email };
        }

        throw error;
    }

    return EMPTY_AUTH_STATE;
}

/** Kicks off the GitHub OAuth handshake; the provider decides where the user goes next. */
export async function signInWithGitHub() {
    await signIn("github", { redirectTo: AFTER_SIGN_IN("back") });
}

/** Clears the session and returns to the sign-in page rather than a route the proxy would bounce. */
export async function signOutAction() {
    await signOut({ redirectTo: "/sign-in" });
}
