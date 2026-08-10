"use client";

import { useActionState, useState } from "react";
import { Trash2 } from "lucide-react";

import { deleteAccount } from "@/actions/account";
import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EMPTY_ACCOUNT_STATE } from "@/types/account";

/**
 * Deletes the account, behind a confirmation the user has to type out.
 *
 * The typed email is the point: a destructive dialog whose confirm button is one click away is
 * dismissed on reflex, and this action has no undo and no trash to recover from. Making the user
 * reproduce their own address forces them to read what they are about to lose. The action re-checks
 * the value server-side — the disabled button here is a convenience, not the control.
 *
 * The confirm is a plain submit button rather than `AlertDialogAction`, which closes the dialog on
 * click: the action can fail, and a dialog that has already dismissed itself has nowhere to report
 * that.
 */
export function DeleteAccountDialog({
    email,
    itemCount,
    collectionCount,
}: {
    email: string;
    itemCount: number;
    collectionCount: number;
}) {
    const [state, formAction, isPending] = useActionState(deleteAccount, EMPTY_ACCOUNT_STATE);
    const [open, setOpen] = useState(false);
    const [confirmation, setConfirmation] = useState("");

    // Matches the server's comparison. Case and padding are not what makes this deliberate.
    const confirmed = confirmation.trim().toLowerCase() === email.toLowerCase();

    return (
        <AlertDialog
            open={open}
            onOpenChange={(next) => {
                setOpen(next);
                // Cleared on close so reopening does not present an already-armed confirm button.
                if (!next) setConfirmation("");
            }}
        >
            <AlertDialogTrigger asChild>
                {/* `shrink-0` because `SettingsRow` lays the copy and this button out on one row:
                    without it the flex row steals width from the label before the sentence. */}
                <Button variant="destructive" size="lg" className="shrink-0">
                    <Trash2 className="size-4" aria-hidden="true" />
                    Delete account
                </Button>
            </AlertDialogTrigger>

            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete account</AlertDialogTitle>
                    <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete your account,
                        along with {itemCount === 1 ? "1 item" : `${itemCount} items`} and{" "}
                        {collectionCount === 1 ? "1 collection" : `${collectionCount} collections`}.
                    </AlertDialogDescription>
                </AlertDialogHeader>

                <form action={formAction} className="space-y-4">
                    <div className="space-y-1.5">
                        <label htmlFor="confirmation" className="text-sm font-medium">
                            To confirm, type <span className="font-mono">{email}</span>
                        </label>
                        <Input
                            id="confirmation"
                            name="confirmation"
                            value={confirmation}
                            onChange={(event) => setConfirmation(event.target.value)}
                            autoComplete="off"
                            // A password manager offering to fill the address here would undo the
                            // deliberateness the field exists to create.
                            data-1p-ignore
                            aria-invalid={state.fields?.confirmation ? true : undefined}
                            aria-describedby={
                                state.fields?.confirmation ? "confirmation-error" : undefined
                            }
                        />
                        {state.fields?.confirmation && (
                            <p id="confirmation-error" className="text-sm text-destructive">
                                {state.fields.confirmation}
                            </p>
                        )}
                    </div>

                    {state.error && (
                        <p role="alert" className="text-sm text-destructive">
                            {state.error}
                        </p>
                    )}

                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
                        <Button
                            type="submit"
                            variant="destructive"
                            size="lg"
                            disabled={isPending || !confirmed}
                            className="w-full sm:w-auto"
                        >
                            {isPending ? "Deleting…" : "I understand, delete my account"}
                        </Button>
                    </AlertDialogFooter>
                </form>
            </AlertDialogContent>
        </AlertDialog>
    );
}
