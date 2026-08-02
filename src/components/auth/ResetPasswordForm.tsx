"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { newPasswordSchema } from "@/lib/auth-schemas";

type FieldErrors = Partial<Record<"password" | "confirmPassword", string[]>>;

/**
 * Chooses the new password.
 *
 * The token is a prop rather than a field the user can see: it came from the link, and there is
 * nothing they could do about it if it were wrong. It is still submitted in the body — the server
 * has no other way to know which account this is.
 */
export function ResetPasswordForm({ token }: { token: string }) {
    const router = useRouter();
    const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
    const [formError, setFormError] = useState<string | null>(null);
    // A spent or expired token can only be answered by starting over, so that failure is shown with
    // the link that does it rather than as a message the user can only reread.
    const [needsNewLink, setNeedsNewLink] = useState(false);
    const [isPending, setIsPending] = useState(false);

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setFieldErrors({});
        setFormError(null);
        setNeedsNewLink(false);

        const form = new FormData(event.currentTarget);

        // Validated with the same rules the route re-runs on the server. This pass is only to spare
        // a round trip — the server's is the one that decides.
        const parsed = newPasswordSchema.safeParse(Object.fromEntries(form));

        if (!parsed.success) {
            setFieldErrors(z.flattenError(parsed.error).fieldErrors);
            return;
        }

        setIsPending(true);

        try {
            const response = await fetch("/api/auth/reset-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...parsed.data, token }),
            });

            if (response.ok) {
                // `isPending` stays true through the redirect: the button keeps its disabled state
                // until the next page takes over, which is what stops a second submission against a
                // token that has already been spent.
                //
                // Not signed in from here. The password is new and unproven, and sending them
                // through the form they already know is one step, not a favour worth the ambiguity
                // of a session that appeared without anyone typing a password.
                router.push("/sign-in?reset=1");
                return;
            }

            const body = await response.json().catch(() => null);

            setFieldErrors(body?.fields ?? {});
            setFormError(body?.error ?? "Could not reset your password. Try again.");
            setNeedsNewLink(body?.code === "expired" || body?.code === "invalid");
        } catch {
            setFormError("Could not reach the server. Check your connection and try again.");
        }

        setIsPending(false);
    }

    return (
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div className="space-y-1.5">
                <label htmlFor="password" className="text-sm font-medium">
                    New password
                </label>
                <PasswordInput
                    id="password"
                    name="password"
                    autoComplete="new-password"
                    aria-invalid={fieldErrors.password ? true : undefined}
                    aria-describedby={fieldErrors.password ? "password-error" : undefined}
                />
                {fieldErrors.password && (
                    <p id="password-error" className="text-sm text-destructive">
                        {fieldErrors.password[0]}
                    </p>
                )}
            </div>

            <div className="space-y-1.5">
                <label htmlFor="confirmPassword" className="text-sm font-medium">
                    Confirm new password
                </label>
                <PasswordInput
                    id="confirmPassword"
                    name="confirmPassword"
                    autoComplete="new-password"
                    aria-invalid={fieldErrors.confirmPassword ? true : undefined}
                    aria-describedby={
                        fieldErrors.confirmPassword ? "confirmPassword-error" : undefined
                    }
                />
                {fieldErrors.confirmPassword && (
                    <p id="confirmPassword-error" className="text-sm text-destructive">
                        {fieldErrors.confirmPassword[0]}
                    </p>
                )}
            </div>

            {formError && (
                <div className="text-sm text-destructive">
                    <p role="alert">{formError}</p>
                    {needsNewLink && (
                        <Link href="/forgot-password" className="font-medium underline">
                            Request a new reset link
                        </Link>
                    )}
                </div>
            )}

            <Button type="submit" disabled={isPending} className="w-full">
                {isPending ? "Saving…" : "Set new password"}
            </Button>
        </form>
    );
}
