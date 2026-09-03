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
 * The settings page's "Change password" row control and the form behind it.
 *
 * Behind a trigger so every panel row reads the same way — a label, a line of copy, one control.
 * A plain `Dialog`, not the delete row's `AlertDialog`: this is an ordinary form whose worst
 * outcome is a rejection message.
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
 * Changes the password on a credentials account, via the `changePassword` Server Action.
 *
 * Rendered only when the account has a password; the action re-checks that independently. No
 * client-side validation pass — the server is consulted anyway to verify the current password, so
 * a second rule set on the client would only drift.
 *
 * A separate component from the dialog: Radix unmounts the content on close, so the fields and
 * action state clear with no `reset()` to remember. Failures keep the dialog open, where the
 * message can be read.
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
