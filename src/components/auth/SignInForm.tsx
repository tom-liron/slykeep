"use client";

import Link from "next/link";
import { useActionState } from "react";

import { signInWithCredentials } from "@/actions/auth";
import { ResendVerification } from "@/components/auth/ResendVerification";
import { AuthField } from "@/components/ui/AuthField";
import { Button } from "@/components/ui/button";
import { invalidProps } from "@/components/ui/Field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { EMPTY_AUTH_STATE } from "@/types/auth";

/**
 * The email/password sign-in form, driven by the `signInWithCredentials` Server Action through
 * `useActionState`.
 *
 * One of the two controls on `/sign-in` (the other is `GitHubSignInButton`). `callbackUrl` travels
 * as a hidden field because a Server Action cannot read the URL of the page that invoked it. On a
 * rejected credential it renders {@link ResendVerification} when the account is unverified.
 */
export function SignInForm({ callbackUrl }: { callbackUrl?: string }) {
    const [state, formAction, isPending] = useActionState(signInWithCredentials, EMPTY_AUTH_STATE);

    // `noValidate` so a malformed `type="email"` is caught by this form's own validation rather
    // than the browser's native bubble, which does not survive a React form submission and so
    // produces no message. Matches the register form.
    return (
        <form action={formAction} noValidate className="space-y-4">
            {/* Submitted rather than read: a Server Action has no access to the URL of the page it
                was invoked from, so the destination has to travel with the form. */}
            {callbackUrl && <input type="hidden" name="callbackUrl" value={callbackUrl} />}

            <AuthField id="email" label="Email" error={state.fields?.email}>
                <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    // Keyed on the returned value so React remounts the input and picks up the new
                    // default; without the key it keeps the reset-to-empty DOM node.
                    key={state.email}
                    defaultValue={state.email}
                    {...invalidProps("email", state.fields?.email)}
                    // Overrides only the `aria-invalid` from the spread: a rejected credential
                    // (`state.error`) marks both fields, since which one was wrong is not
                    // disclosed, while a format problem marks only its own. The `aria-describedby`
                    // is untouched — no message to point at unless this field was rejected.
                    aria-invalid={state.error || state.fields?.email ? true : undefined}
                />
            </AuthField>

            <AuthField
                id="password"
                label="Password"
                error={state.fields?.password}
                action={
                    /* Beside the field it is about, which is where someone looks the moment they
                       realise they cannot fill it in. This is the one field on any of these forms
                       with something on its label row, and the reason `AuthField` has an `action`. */
                    <Link
                        href="/forgot-password"
                        className="text-sm text-muted-foreground hover:text-foreground hover:underline"
                    >
                        Forgot password?
                    </Link>
                }
            >
                <PasswordInput
                    id="password"
                    name="password"
                    autoComplete="current-password"
                    {...invalidProps("password", state.fields?.password)}
                    // Widened for the same reason as the email field above.
                    aria-invalid={state.error || state.fields?.password ? true : undefined}
                />
            </AuthField>

            {/* Every failure reports here or against its field. Toasts are for the successful
                outcome only, so there is exactly one place to look when something goes wrong. */}
            {state.error && (
                <div className="text-sm text-destructive">
                    <p role="alert">{state.error}</p>
                    {/* The only failure a user can act on from this form. Their password was
                        accepted, so the address is theirs and prefilling it is safe — and it
                        spares them retyping it into a second box on the same screen. */}
                    {state.unverified && <ResendVerification defaultEmail={state.email} />}
                </div>
            )}

            <Button type="submit" disabled={isPending} className="w-full">
                {isPending ? "Signing in…" : "Sign in"}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
                Don&apos;t have an account?{" "}
                <Link href="/register" className="font-medium text-foreground hover:underline">
                    Create one
                </Link>
            </p>
        </form>
    );
}
