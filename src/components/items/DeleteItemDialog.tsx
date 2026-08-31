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
import { ActionLabel } from "./ActionLabel";

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
                {/* Built like the four controls beside it in the drawer's action row, because it
                    is the fifth of them: the same `size`, the same `title` and `aria-label` pair,
                    and the same `ActionLabel` — so it shows the word "Delete" on a wide screen and
                    drops to the icon alone below `sm`, in step with the rest. It was `icon-sm` with
                    a bare `sr-only` name and no `title` at all, which made it the one button in the
                    row with no visible word at any width *and* no tooltip on hover.

                    What stays different is the colour, and only the colour: `text-destructive` on
                    the glyph and its word, held through hover. `hover:text-destructive` is not
                    redundant — the ghost variant sets `hover:text-foreground`, which outranks a
                    plain `text-destructive`, so without it the one control that destroys something
                    turns the same white as the four that do not, at exactly the moment the pointer
                    is on it. Red on hover is also what `CollectionActions` already does for its own
                    delete, and it is the ordinary convention: a destructive action keeps its
                    colour, because the colour *is* the warning.

                    No hover fill of its own either — the row states one for every control inside
                    it, and repeating it here is how the two would come to disagree. */}
                <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    title="Delete"
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
                        className="w-full sm:w-auto"
                    >
                        {isPending ? "Deleting…" : "Delete item"}
                    </Button>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
