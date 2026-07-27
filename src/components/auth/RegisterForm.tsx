"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { z } from "zod";

import { signInWithCredentials } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { registerSchema } from "@/lib/auth-schemas";
import { EMPTY_AUTH_STATE } from "@/types/auth";

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

        try {
            const response = await fetch("/api/auth/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(parsed.data),
            });

            created = response.ok;

            if (!created) {
                const body = await response.json().catch(() => null);

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

        // Signing in happens outside the fetch's try/catch on purpose: a successful sign-in leaves
        // by throwing NEXT_REDIRECT, and catching that here would swallow the navigation and show
        // a network error on what was actually a success.
        const credentials = new FormData();
        credentials.set("email", parsed.data.email);
        credentials.set("password", parsed.data.password);
        // Tells the action to land on `/?welcome=new`, so the toast greets a new account rather
        // than welcoming back someone who has never signed in.
        credentials.set("welcome", "new");

        const result = await signInWithCredentials(EMPTY_AUTH_STATE, credentials);

        // Only reachable if the account was created but the sign-in did not take. The account is
        // real, so say so and send them to sign in by hand rather than implying it failed.
        setIsPending(false);
        setFormError(result.error ?? "Account created, but we could not sign you in.");
        router.push("/sign-in?registered=1");
    }

    return (
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
            {FIELDS.map((field) => {
                const Field = field.type === "password" ? PasswordInput : Input;

                return (
                    <div key={field.name} className="space-y-1.5">
                        <label htmlFor={field.name} className="text-sm font-medium">
                            {field.label}
                        </label>
                        <Field
                            id={field.name}
                            name={field.name}
                            // `PasswordInput` owns its own type so it can flip it; only the plain
                            // inputs need one passed in.
                            {...(field.type === "password" ? {} : { type: field.type })}
                            autoComplete={field.autoComplete}
                            aria-invalid={fieldErrors[field.name] ? true : undefined}
                            aria-describedby={
                                fieldErrors[field.name] ? `${field.name}-error` : undefined
                            }
                        />
                        {fieldErrors[field.name] && (
                            <p id={`${field.name}-error`} className="text-sm text-destructive">
                                {fieldErrors[field.name]?.[0]}
                            </p>
                        )}
                    </div>
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
