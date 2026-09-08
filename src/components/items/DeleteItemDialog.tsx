"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { deleteItem } from "@/actions/items";
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
import { useWriteBlockedReason } from "@/components/layout/VerifiedContext";
import { Button } from "@/components/ui/button";
import { ActionLabel } from "./ActionLabel";

/**
 * The drawer's Delete control and its confirmation dialog.
 *
 * One click behind an `AlertDialog` — an item is one row a user can re-create, so it does not need
 * the typed confirmation `DeleteAccountDialog` uses. The dialog names the item, since the drawer is
 * open over a list of similar-looking cards.
 *
 * @remarks
 * The confirm is a plain `<Button>`, not `AlertDialogAction`, which dismisses the dialog on click:
 * `deleteItem` can fail, and a closed dialog has nowhere to report it. On success the caller closes
 * the drawer and `router.refresh()` re-fetches the server-rendered list, which still holds the
 * deleted row.
 */
export function DeleteItemDialog({
    itemId,
    title,
    onDeleted,
}: {
    itemId: string;
    title: string;
    onDeleted: () => void;
}) {
    // Disabled rather than hidden for an unconfirmed account, so the control stays where the user
    // expects it and says on hover what would bring it back. `deleteItem` refuses independently.
    const blocked = useWriteBlockedReason();

    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [isPending, startTransition] = useTransition();

    const confirmDelete = () => {
        startTransition(async () => {
            const result = await deleteItem(itemId);

            if (!result.success) {
                toast.error(result.error);

                return;
            }

            setOpen(false);
            toast.success("Item deleted.");
            onDeleted();
            router.refresh();
        });
    };

    return (
        <AlertDialog open={open} onOpenChange={setOpen}>
            <AlertDialogTrigger asChild>
                {/* The fifth control in the drawer's action row, built like the other four: same
                    `size`, same `title`/`aria-label` pair, same `ActionLabel`, so it shows "Delete"
                    on a wide screen and drops to the icon alone below 680px (`min-[42.5rem]`) in
                    step with them.

                    Only the colour differs: `text-destructive` on the glyph and word, held through
                    hover. `hover:text-destructive` is required because the ghost variant's
                    `hover:text-foreground` outranks a plain `text-destructive`, which would turn
                    this control the same colour as the others under the pointer. A destructive
                    action keeps its colour — the colour is the warning — as `CollectionActions`
                    does for its own delete.

                    No hover fill here: the row sets one for every control inside it. */}
                <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    disabled={blocked !== null}
                    title={blocked ?? "Delete"}
                    aria-label="Delete"
                >
                    <Trash2 aria-hidden="true" />
                    <ActionLabel>Delete</ActionLabel>
                </Button>
            </AlertDialogTrigger>

            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete item</AlertDialogTitle>
                    <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete{" "}
                        <span className="font-medium text-foreground">{title}</span> and remove it
                        from every collection holding it.
                    </AlertDialogDescription>
                </AlertDialogHeader>

                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
                    <Button
                        type="button"
                        variant="destructive"
                        onClick={confirmDelete}
                        disabled={isPending}
                        className="w-full @sm:w-auto"
                    >
                        {isPending ? "Deleting…" : "Delete item"}
                    </Button>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
