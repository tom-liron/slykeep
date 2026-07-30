"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { registerSchema } from "@/lib/auth-schemas";

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

        // `isPending` stays true through the redirect on purpose: the button keeps its disabled,
        // "Creating account…" state until the new page takes over, which is what stops a second
        // submission during the navigation. Clearing it here would flash an enabled button.

        // The account is deliberately *not* signed in here. It is created with `emailVerified`
        // null, and `authorize` refuses that — attempting a sign-in would fail on purpose and read
        // to the user as a broken registration. The link in their inbox is the next step.
        //
        // `emailSent` only means Resend accepted the request, so `registered=sent` is a claim about
        // what we attempted, not proof anything was delivered. When the send fails outright the
        // sign-in page says so rather than pointing at an inbox that will stay empty.
        router.push(`/sign-in?registered=${emailSent ? "sent" : "unsent"}`);
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
