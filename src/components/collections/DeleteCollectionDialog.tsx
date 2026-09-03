"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { deleteCollection } from "@/actions/collections";
import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { CollectionActionTarget } from "@/types/collection";

/**
 * The confirmation dialog for deleting a collection, calling `deleteCollection`.
 *
 * Controlled from outside, like `EditCollectionDialog`: it opens from a header button on the
 * collection page and a dropdown item on a card, and a Radix menu unmounts anything nested in the
 * item it closes on. The wording states that the items are kept — `ItemCollection` cascades on the
 * collection side only, so they stop belonging to this collection but keep existing.
 *
 * @remarks
 * `afterDeleteHref` differs by call site: a card refreshes in place, the collection's own page
 * navigates away because that route 404s once the row is gone. A string, not a callback, since
 * both call sites are server components.
 */
export function DeleteCollectionDialog({
    collection,
    open,
    onOpenChange,
    afterDeleteHref,
}: {
    collection: CollectionActionTarget;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    afterDeleteHref?: string;
}) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    const confirmDelete = () => {
        startTransition(async () => {
            const result = await deleteCollection(collection.id);

            if (!result.success) {
                toast.error(result.error);

                return;
            }

            onOpenChange(false);
            toast.success("Collection deleted.");

            if (afterDeleteHref) {
                // Navigate away with no `router.refresh()`: refreshing re-runs the current route,
                // which is the collection just deleted, so it hits `notFound()` and paints a 404
                // over the page being left — and a refresh after the push targets the same dead
                // route in the same transition. `deleteCollection` revalidates on the server, so
                // this navigation re-fetches the destination and the sidebar anyway. `replace`, not
                // `push`, so the deleted URL is not one Back press from a 404.
                router.replace(afterDeleteHref);

                return;
            }

            // Staying put: re-render the current route — the list this card was in, and the
            // sidebar and stat cards around it.
            router.refresh();
        });
    };

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete collection</AlertDialogTitle>
                    <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete{" "}
                        <span className="font-medium text-foreground">{collection.name}</span>. The
                        items in it are kept — they will just no longer belong to this collection.
                    </AlertDialogDescription>
                </AlertDialogHeader>

                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
                    {/* A plain button rather than `AlertDialogAction`, which dismisses on click: the
                        action can fail, and a dialog that has already closed has nowhere to say so. */}
                    <Button
                        type="button"
                        variant="destructive"
                        onClick={confirmDelete}
                        disabled={isPending}
                        className="w-full @sm:w-auto"
                    >
                        {isPending ? "Deleting…" : "Delete collection"}
                    </Button>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
