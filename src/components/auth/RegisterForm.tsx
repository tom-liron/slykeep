"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { z } from "zod";

import { signInAfterRegister } from "@/actions/auth";
import { AuthField } from "@/components/ui/AuthField";
import { Button } from "@/components/ui/button";
import { invalidProps } from "@/components/ui/Field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { DEFAULT_SIGN_IN_DESTINATION } from "@/lib/auth-redirects";
import { registerSchema } from "@/lib/auth-schemas";

/**
 * The account-creation form, posting to `POST /api/auth/register` (a route, not a Server Action,
 * so the client can tell a 400 from a 409).
 *
 * The credentials half of `/register`, beside `GitHubSignInButton`. On success it opens a session
 * with the credentials it already holds and lands in the app, so a new account is usable before the
 * confirmation email arrives.
 *
 * @remarks
 * The account is created with `emailVerified: null` and stays that way until the link is clicked.
 * That is not a sign-in gate: it makes the account read-only — `readOnlyRefusal` in
 * `server/access.ts` is what enforces it — and the dashboard banner is what asks for the
 * confirmation.
 */

type FieldErrors = Partial<Record<"name" | "email" | "password" | "confirmPassword", string[]>>;

const FIELDS = [
    { name: "name", label: "Name", type: "text", autoComplete: "name" },
    { name: "email", label: "Email", type: "email", autoComplete: "email" },
    { name: "password", label: "Password", type: "password", autoComplete: "new-password" },
    {
        name: "confirmPassword",
        label: "Confirm password",
        type: "password",
        autoComplete: "new-password",
    },
] as const;

export function RegisterForm() {
    const router = useRouter();
    const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
    const [formError, setFormError] = useState<string | null>(null);
    const [isPending, setIsPending] = useState(false);

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setFieldErrors({});
        setFormError(null);

        const form = new FormData(event.currentTarget);

        // Validated with the same schema the route re-runs on the server. This pass is only to
        // spare a round trip — the server's is the one that decides.
        const parsed = registerSchema.safeParse(Object.fromEntries(form));

        if (!parsed.success) {
            setFieldErrors(z.flattenError(parsed.error).fieldErrors);
            return;
        }

        setIsPending(true);

        let created = false;
        let emailSent = false;

        try {
            const response = await fetch("/api/auth/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(parsed.data),
            });

            created = response.ok;

            const body = await response.json().catch(() => null);

            if (created) {
                // An unreadable body on a 201 is a transport hiccup, not evidence the email failed
                // — the route always includes the flag. Assume it was sent rather than alarming
                // someone about a send that probably happened; either way the next screen carries
                // a resend control.
                emailSent = body === null || body.emailSent === true;
            } else {
                setFieldErrors(body?.fields ?? {});
                setFormError(body?.error ?? "Could not create your account. Try again.");
            }
        } catch {
            setFormError("Could not reach the server. Check your connection and try again.");
        }

        if (!created) {
            setIsPending(false);
            return;
        }

        // `isPending` stays true through the redirect: the button keeps its disabled
        // "Creating account…" state until the next page takes over, which stops a second
        // submission during the navigation.

        // Signed in with the credentials still in hand, so a new account works immediately and
        // confirms its address afterwards.
        const signedIn = await signInAfterRegister(parsed.data.email, parsed.data.password);

        // The account exists whether or not the session opened, so a refusal is a detour to the
        // sign-in form rather than a failed registration. `emailSent` only means Resend accepted
        // the request, which is why that screen carries a resend control either way.
        if (!signedIn) {
            router.push(`/sign-in?registered=${emailSent ? "sent" : "unsent"}`);
            return;
        }

        router.push(DEFAULT_SIGN_IN_DESTINATION);
        // The session cookie was set by the action, so the server components above this one have to
        // be re-rendered with it before the destination reads the new user.
        router.refresh();
    }

    return (
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
            {FIELDS.map((field) => {
                const Control = field.type === "password" ? PasswordInput : Input;

                return (
                    <AuthField
                        key={field.name}
                        id={field.name}
                        label={field.label}
                        error={fieldErrors[field.name]?.[0]}
                    >
                        <Control
                            id={field.name}
                            name={field.name}
                            // `PasswordInput` owns its own type so it can flip it; only the plain
                            // inputs need one passed in.
                            {...(field.type === "password" ? {} : { type: field.type })}
                            autoComplete={field.autoComplete}
                            {...invalidProps(field.name, fieldErrors[field.name]?.[0])}
                        />
                    </AuthField>
                );
            })}

            {formError && (
                <p role="alert" className="text-sm text-destructive">
                    {formError}
                </p>
            )}

            <Button type="submit" disabled={isPending} className="w-full">
                {isPending ? "Creating account…" : "Create account"}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link href="/sign-in" className="font-medium text-foreground hover:underline">
                    Sign in
                </Link>
            </p>
        </form>
    );
}
