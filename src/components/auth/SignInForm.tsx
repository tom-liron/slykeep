"use client";

import Link from "next/link";
import { useActionState } from "react";

import { signInWithCredentials } from "@/actions/auth";
import { ResendVerification } from "@/components/auth/ResendVerification";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { EMPTY_AUTH_STATE } from "@/types/auth";

export function SignInForm() {
    const [state, formAction, isPending] = useActionState(signInWithCredentials, EMPTY_AUTH_STATE);

    // `noValidate` because `type="email"` otherwise lets the browser reject a malformed address
    // before the action runs — silently, since the native bubble does not survive a React form
    // submission. The field produced no message at all. Our own validation reports it instead,
    // matching the register form.
    return (
        <form action={formAction} noValidate className="space-y-4">
            <div className="space-y-1.5">
                <label htmlFor="email" className="text-sm font-medium">
                    Email
                </label>
                <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    // Keyed on the returned value so React remounts the input and picks up the new
                    // default; without the key it keeps the reset-to-empty DOM node.
                    key={state.email}
                    defaultValue={state.email}
                    // A rejected credential (`state.error`) marks both fields, since which one was
                    // wrong is deliberately not disclosed. A format problem marks only its own.
                    aria-invalid={state.error || state.fields?.email ? true : undefined}
                    aria-describedby={state.fields?.email ? "email-error" : undefined}
                />
                {state.fields?.email && (
                    <p id="email-error" className="text-sm text-destructive">
                        {state.fields.email}
                    </p>
                )}
            </div>

            <div className="space-y-1.5">
                <div className="flex items-baseline justify-between gap-3">
                    <label htmlFor="password" className="text-sm font-medium">
                        Password
                    </label>
                    {/* Beside the field it is about, which is where someone looks the moment they
                        realise they cannot fill it in. */}
                    <Link
                        href="/forgot-password"
                        className="text-sm text-muted-foreground hover:text-foreground hover:underline"
                    >
                        Forgot password?
                    </Link>
                </div>
                <PasswordInput
                    id="password"
                    name="password"
                    autoComplete="current-password"
                    aria-invalid={state.error || state.fields?.password ? true : undefined}
                    aria-describedby={state.fields?.password ? "password-error" : undefined}
                />
                {state.fields?.password && (
                    <p id="password-error" className="text-sm text-destructive">
                        {state.fields.password}
                    </p>
                )}
            </div>

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
