"use client";

import { useActionState, useCallback, useEffect, useState } from "react";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";

import { changePassword } from "@/actions/account";
import { AuthField } from "@/components/ui/AuthField";
import { Button } from "@/components/ui/button";
import { invalidProps } from "@/components/ui/Field";
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { EMPTY_ACCOUNT_STATE } from "@/types/account";

/**
 * The settings page's "Change password" control and the form behind it.
 *
 * Behind a trigger rather than inline, so every row in the panel reads the same way: a label, a line
 * of copy, and one control. Three password fields sitting open on a page nobody came to change their
 * password on is a form to scroll past, not an offer.
 *
 * A plain `Dialog`, not the `AlertDialog` the delete row uses — that primitive exists to make a
 * destructive confirmation deliberate, and this is an ordinary form whose worst outcome is a
 * rejection message.
 */
export function ChangePasswordDialog() {
    const [open, setOpen] = useState(false);

    // Stable, so the success effect below depends on `state.success` alone. A fresh closure each
    // render would re-run it while the dialog plays its exit animation, toasting twice.
    const close = useCallback(() => setOpen(false), []);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {/* `shrink-0` because `SettingsRow` lays the copy and this button out on one row:
                    without it the flex row steals width from the label before the sentence. */}
                <Button size="lg" className="shrink-0">
                    <KeyRound className="size-4" aria-hidden="true" />
                    Change password
                </Button>
            </DialogTrigger>

            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Change password</DialogTitle>
                    <DialogDescription>
                        Update the password you use to sign in to DevStash.
                    </DialogDescription>
                </DialogHeader>

                <ChangePasswordForm onChanged={close} />
            </DialogContent>
        </Dialog>
    );
}

/**
 * Changes the password on a credentials account.
 *
 * Rendered only when the account has a password — a GitHub-only account has none to change, and the
 * action refuses the call independently rather than trusting that this component was the caller.
 *
 * No client-side validation pass, unlike `ResetPasswordForm`. That one is unauthenticated and worth
 * sparing a round trip; here the server has to be consulted anyway to check the current password,
 * so a second set of rules on the client would only be a second place for them to drift.
 *
 * A separate component from the dialog on purpose: Radix unmounts the content on close, so the
 * fields and the action state clear themselves and there is no `reset()` to remember. Failures keep
 * the dialog open, which is the only place their messages can be read.
 */
function ChangePasswordForm({ onChanged }: { onChanged: () => void }) {
    const [state, formAction, isPending] = useActionState(changePassword, EMPTY_ACCOUNT_STATE);

    // Closing is what clears the fields — they hold a password that now works, and leaving them
    // filled invites a second submission that would fail against the credential it just replaced.
    // Toasting rather than rendering a message keeps the confirmation visible after the dialog goes.
    useEffect(() => {
        if (state.success) {
            onChanged();
            toast.success("Password updated.");
        }
    }, [state.success, onChanged]);

    return (
        <form action={formAction} noValidate className="space-y-4">
            <AuthField
                id="currentPassword"
                label="Current password"
                error={state.fields?.currentPassword}
            >
                <PasswordInput
                    id="currentPassword"
                    name="currentPassword"
                    autoComplete="current-password"
                    {...invalidProps("currentPassword", state.fields?.currentPassword)}
                />
            </AuthField>

            <AuthField id="password" label="New password" error={state.fields?.password}>
                <PasswordInput
                    id="password"
                    name="password"
                    autoComplete="new-password"
                    {...invalidProps("password", state.fields?.password)}
                />
            </AuthField>

            <AuthField
                id="confirmPassword"
                label="Confirm new password"
                error={state.fields?.confirmPassword}
            >
                <PasswordInput
                    id="confirmPassword"
                    name="confirmPassword"
                    autoComplete="new-password"
                    {...invalidProps("confirmPassword", state.fields?.confirmPassword)}
                />
            </AuthField>

            {state.error && (
                <p role="alert" className="text-sm text-destructive">
                    {state.error}
                </p>
            )}

            <DialogFooter>
                <DialogClose asChild>
                    <Button type="button" variant="outline" disabled={isPending}>
                        Cancel
                    </Button>
                </DialogClose>
                {/* Submit stays a plain button, not a `DialogClose`: the action can fail, and a
                    dialog that has already dismissed has nowhere to report it. */}
                <Button type="submit" size="lg" disabled={isPending}>
                    {isPending ? "Updating…" : "Update password"}
                </Button>
            </DialogFooter>
        </form>
    );
}
