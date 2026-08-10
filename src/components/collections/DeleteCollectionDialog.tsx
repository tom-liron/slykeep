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
 * The confirmation in front of deleting a collection.
 *
 * Controlled from outside for the same reason `EditCollectionDialog` is: it opens from a header
 * button on the collection's page and from a dropdown item on a card, and a Radix menu unmounts
 * anything nested inside the item it closes on.
 *
 * The wording carries the one thing a user is right to worry about — that deleting a collection
 * might take its items with it. It does not: `ItemCollection` cascades on the collection side only,
 * so the items keep existing and simply stop belonging to this collection.
 *
 * `afterDeleteHref` is what a card and a page disagree about. From a card the list behind it just
 * needs re-fetching, so it stays put and refreshes; from the collection's own page there is nowhere
 * to stay — that route 404s the moment the row is gone — so it navigates. A string rather than a
 * callback, because both call sites are reached from server components, which cannot pass functions.
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
                // Navigate away, and do *not* refresh on the way out. `router.refresh()` re-renders
                // the route you are currently on — which here is the collection that has just been
                // deleted, so it re-runs the page, hits `notFound()`, and paints a 404 over the page
                // being left. Refreshing after the push does not avoid it either: the two are
                // dispatched in the same transition and the refresh still targets the dead route.
                //
                // Nothing is lost by dropping it. `deleteCollection` revalidates on the server, so
                // the destination and the sidebar above it are both re-fetched by this navigation.
                //
                // `replace` rather than `push`, so the deleted collection's URL does not stay in
                // history one Back press away from a 404.
                router.replace(afterDeleteHref);

                return;
            }

            // Staying put: this is the one case where re-rendering the current route is the point —
            // the list this card was in, and the sidebar and stat cards around it.
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
                        className="w-full sm:w-auto"
                    >
                        {isPending ? "Deleting…" : "Delete collection"}
                    </Button>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
