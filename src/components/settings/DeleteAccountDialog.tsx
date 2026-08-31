"use client";

import { useActionState, useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { deleteAccount } from "@/actions/account";
import { openBillingPortal } from "@/actions/billing";
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
import { AuthField } from "@/components/ui/AuthField";
import { Button } from "@/components/ui/button";
import { invalidProps } from "@/components/ui/Field";
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
 *
 * A subscriber whose card would be charged again is not offered the confirmation at all — the
 * account cannot be deleted while that is true, so the dialog explains it and hands them the portal
 * instead. The refusal has to be a route rather than a wall: a dialog that says "you can't do this"
 * and stops is the dark pattern the typed confirmation is otherwise avoiding.
 *
 * The prop is deliberately not `isPro`. Someone who has already cancelled is still Pro until their
 * period ends and *can* delete their account — branching on `isPro` told them to cancel, and then
 * told them again after they had, with no way out. `deleteAccount` asks Stripe, and that is the
 * control; this only decides which body to draw.
 */
export function DeleteAccountDialog({
    email,
    subscriptionBlocksDeletion,
    itemCount,
    collectionCount,
}: {
    email: string;
    subscriptionBlocksDeletion: boolean;
    itemCount: number;
    collectionCount: number;
}) {
    const [state, formAction, isPending] = useActionState(deleteAccount, EMPTY_ACCOUNT_STATE);
    const [open, setOpen] = useState(false);
    const [confirmation, setConfirmation] = useState("");
    const [portalPending, startPortal] = useTransition();

    // Only ever returns on failure — success is a redirect to Stripe — so any value is an error.
    const cancelSubscription = () =>
        startPortal(async () => {
            const result = await openBillingPortal();
            if (result) toast.error(result.error);
        });

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
                    <AlertDialogTitle>
                        {subscriptionBlocksDeletion
                            ? "Cancel your subscription first"
                            : "Delete account"}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                        {subscriptionBlocksDeletion ? (
                            <>
                                Your Pro subscription has to be cancelled before the account can be
                                deleted — otherwise your card would keep being charged for an
                                account that no longer exists. Cancelling is done in Stripe, and you
                                keep Pro until the period you have already paid for runs out. Come
                                back here afterwards to delete the account.
                            </>
                        ) : (
                            <>
                                This action cannot be undone. This will permanently delete your
                                account, along with{" "}
                                {itemCount === 1 ? "1 item" : `${itemCount} items`} and{" "}
                                {collectionCount === 1
                                    ? "1 collection"
                                    : `${collectionCount} collections`}
                                .
                            </>
                        )}
                    </AlertDialogDescription>
                </AlertDialogHeader>

                {subscriptionBlocksDeletion ? (
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={portalPending}>Close</AlertDialogCancel>
                        <Button
                            onClick={cancelSubscription}
                            disabled={portalPending}
                            size="lg"
                            className="w-full @sm:w-auto"
                        >
                            {portalPending ? "Opening…" : "Cancel subscription"}
                        </Button>
                    </AlertDialogFooter>
                ) : (
                    <form action={formAction} className="space-y-4">
                        <AuthField
                            id="confirmation"
                            // The one label on any of these forms that is not a plain string, and
                            // the reason `AuthField` takes a `ReactNode`.
                            label={
                                <>
                                    To confirm, type <span className="font-mono">{email}</span>
                                </>
                            }
                            error={state.fields?.confirmation}
                        >
                            <Input
                                id="confirmation"
                                name="confirmation"
                                value={confirmation}
                                onChange={(event) => setConfirmation(event.target.value)}
                                autoComplete="off"
                                // A password manager offering to fill the address here would undo the
                                // deliberateness the field exists to create.
                                data-1p-ignore
                                {...invalidProps("confirmation", state.fields?.confirmation)}
                            />
                        </AuthField>

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
                                className="w-full @sm:w-auto"
                            >
                                {isPending ? "Deleting…" : "I understand, delete my account"}
                            </Button>
                        </AlertDialogFooter>
                    </form>
                )}
            </AlertDialogContent>
        </AlertDialog>
    );
}
