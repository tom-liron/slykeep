"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";

import { changePassword } from "@/actions/account";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { EMPTY_ACCOUNT_STATE } from "@/types/account";

/**
 * Changes the password on a credentials account.
 *
 * Rendered only when the account has a password — a GitHub-only account has none to change, and the
 * action refuses the call independently rather than trusting that this component was the caller.
 *
 * No client-side validation pass, unlike `ResetPasswordForm`. That one is unauthenticated and worth
 * sparing a round trip; here the server has to be consulted anyway to check the current password,
 * so a second set of rules on the client would only be a second place for them to drift.
 */
export function ChangePasswordForm() {
    const [state, formAction, isPending] = useActionState(changePassword, EMPTY_ACCOUNT_STATE);
    const formRef = useRef<HTMLFormElement>(null);

    // The fields hold a password that now works; leaving them filled invites a second submission
    // that would fail against the credential it just replaced. Toasting rather than rendering a
    // message keeps the confirmation visible after the form empties.
    useEffect(() => {
        if (state.success) {
            formRef.current?.reset();
            toast.success("Password updated.");
        }
    }, [state.success]);

    return (
        <form ref={formRef} action={formAction} noValidate className="space-y-4">
            <div className="space-y-1.5">
                <label htmlFor="currentPassword" className="text-sm font-medium">
                    Current password
                </label>
                <PasswordInput
                    id="currentPassword"
                    name="currentPassword"
                    autoComplete="current-password"
                    aria-invalid={state.fields?.currentPassword ? true : undefined}
                    aria-describedby={
                        state.fields?.currentPassword ? "currentPassword-error" : undefined
                    }
                />
                {state.fields?.currentPassword && (
                    <p id="currentPassword-error" className="text-sm text-destructive">
                        {state.fields.currentPassword}
                    </p>
                )}
            </div>

            <div className="space-y-1.5">
                <label htmlFor="password" className="text-sm font-medium">
                    New password
                </label>
                <PasswordInput
                    id="password"
                    name="password"
                    autoComplete="new-password"
                    aria-invalid={state.fields?.password ? true : undefined}
                    aria-describedby={state.fields?.password ? "password-error" : undefined}
                />
                {state.fields?.password && (
                    <p id="password-error" className="text-sm text-destructive">
                        {state.fields.password}
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
                    aria-invalid={state.fields?.confirmPassword ? true : undefined}
                    aria-describedby={
                        state.fields?.confirmPassword ? "confirmPassword-error" : undefined
                    }
                />
                {state.fields?.confirmPassword && (
                    <p id="confirmPassword-error" className="text-sm text-destructive">
                        {state.fields.confirmPassword}
                    </p>
                )}
            </div>

            {state.error && (
                <p role="alert" className="text-sm text-destructive">
                    {state.error}
                </p>
            )}

            <Button type="submit" size="lg" disabled={isPending}>
                {isPending ? "Updating…" : "Update password"}
            </Button>
        </form>
    );
}
