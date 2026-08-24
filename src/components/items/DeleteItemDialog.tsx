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
import { Button } from "@/components/ui/button";

/**
 * The drawer's Delete control, and the confirmation in front of it.
 *
 * One click behind a dialog rather than the typed confirmation `DeleteAccountDialog` demands: an
 * item is one row a user can re-create, not their whole account. The dialog names the item so the
 * one being deleted is never in doubt — the drawer is open over a list of cards that all look alike.
 *
 * The confirm is a plain button rather than `AlertDialogAction`, which dismisses the dialog on
 * click: the action can fail, and a dialog that has already closed has nowhere to report that. On
 * success the caller closes the drawer, and `router.refresh()` re-fetches the list behind it — the
 * cards were rendered on the server and still include the row that has just gone.
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
                {/* `dark:hover:bg-muted` matches the six controls beside it in the drawer's action row —
                    see the note there. Only the fill changes; the text stays destructive. */}
                <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-destructive dark:hover:bg-muted"
                >
                    <Trash2 aria-hidden="true" />
                    <span className="sr-only">Delete</span>
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
                        className="w-full sm:w-auto"
                    >
                        {isPending ? "Deleting…" : "Delete item"}
                    </Button>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
