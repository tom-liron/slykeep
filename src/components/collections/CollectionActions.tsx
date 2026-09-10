"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Pencil, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { toggleCollectionFavorite } from "@/actions/collections";
import { useWriteBlockedReason } from "@/components/layout/VerifiedContext";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TOAST_IDS } from "@/lib/toast-ids";
import { cn } from "@/lib/utils";
import type { CollectionActionTarget } from "@/types/collection";
import { DeleteCollectionDialog } from "./DeleteCollectionDialog";
import { EditCollectionDialog } from "./EditCollectionDialog";

/**
 * Edit, delete, and favorite for one collection, in two layouts.
 *
 * One component so the {@link EditCollectionDialog} / {@link DeleteCollectionDialog} open state is
 * hoisted above both layouts: both dialogs are controlled and rendered here as siblings of the
 * trigger, because a Radix menu unmounts a dialog nested inside a `DropdownMenuItem` in the same
 * frame it opens.
 *
 * `layout` chooses the shape:
 * - `"menu"` — the three-dot control on a card, over a card that is otherwise a link.
 * - `"inline"` — the labelled button row in the collection page's header.
 */
export function CollectionActions({
    collection,
    layout,
    afterDeleteHref,
    className,
}: {
    collection: CollectionActionTarget;
    layout: "menu" | "inline";
    /** Where to go once the collection is gone. See `DeleteCollectionDialog`. */
    afterDeleteHref?: string;
    className?: string;
}) {
    const router = useRouter();
    const [editOpen, setEditOpen] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [isFavoriting, startFavoriting] = useTransition();

    /**
     * What the star shows, which is not always what the prop says.
     *
     * `collection` comes from a server component, so the prop only catches up once the refresh below
     * has round-tripped — long enough for a click to look like it did nothing. Null means "nothing
     * clicked here yet", so the prop wins until this component has written a value of its own, and
     * the prop wins again for a fresh mount.
     */
    const [written, setWritten] = useState<boolean | null>(null);
    const isFavorite = written ?? collection.isFavorite;

    const favorite = () => {
        const next = !isFavorite;

        startFavoriting(async () => {
            const result = await toggleCollectionFavorite(collection.id, next);

            if (!result.success) {
                toast.error(result.error, { id: TOAST_IDS.collectionFavorite });

                return;
            }

            // From what came back, not from `next`: the star follows the row, so it cannot end up
            // filled over a collection the write left alone.
            setWritten(result.data.isFavorite);
            toast.success(
                result.data.isFavorite ? "Added to favorites." : "Removed from favorites.",
                { id: TOAST_IDS.collectionFavorite },
            );

            // The action revalidates the layout, which re-renders the sidebar's favourites; this is
            // what re-renders the page under it — the card's own star, and the collection's header.
            router.refresh();
        });
    };

    const favoriteLabel = isFavorite ? "Remove from favorites" : "Add to favorites";

    // Filled in `--favorite` when on, hollow when off. The app-wide rule this is one case of:
    // **a filled star asserts that this particular thing is favourited; an outline star is the
    // word "favourites" as a place or a concept.** So every badge fills (item/image/file/
    // collection cards, a collection page's title, the sidebar's favourite-collection rows), and
    // every destination stays hollow (the sidebar's Favorites link, the top bar's button,
    // `/favorites`' heading, the dashboard's stat icons). A toggle is the one star that does both.
    //
    // Placement carries the same distinction: a star *before* a heading labels it (`/favorites`),
    // a star *after* a name badges it (a collection's title).
    const star = (
        <Star className={cn(isFavorite && "fill-favorite text-favorite")} aria-hidden="true" />
    );

    // Every control here writes, so all of them go dead for an unconfirmed account. The actions
    // refuse independently; this only decides what is offered.
    const blocked = useWriteBlockedReason();

    return (
        <>
            {layout === "menu" ? (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            className={cn("text-muted-foreground hover:text-foreground", className)}
                        >
                            <MoreHorizontal aria-hidden="true" />
                            <span className="sr-only">Actions for {collection.name}</span>
                        </Button>
                    </DropdownMenuTrigger>

                    <DropdownMenuContent align="end" className="w-52">
                        <DropdownMenuItem
                            onSelect={() => setEditOpen(true)}
                            disabled={blocked !== null}
                            title={blocked ?? undefined}
                        >
                            <Pencil aria-hidden="true" />
                            Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onSelect={favorite}
                            disabled={isFavoriting || blocked !== null}
                            title={blocked ?? undefined}
                        >
                            {star}
                            {favoriteLabel}
                        </DropdownMenuItem>

                        <DropdownMenuSeparator />

                        <DropdownMenuItem
                            variant="destructive"
                            onSelect={() => setDeleteOpen(true)}
                            disabled={blocked !== null}
                            title={blocked ?? undefined}
                        >
                            <Trash2 aria-hidden="true" />
                            Delete
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            ) : (
                <div className={cn("flex items-center gap-1", className)}>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={favorite}
                        disabled={isFavoriting || blocked !== null}
                        title={blocked ?? undefined}
                    >
                        {star}
                        <span className="sr-only">{favoriteLabel}</span>
                    </Button>
                    <Button
                        variant="outline"
                        onClick={() => setEditOpen(true)}
                        disabled={blocked !== null}
                        title={blocked ?? undefined}
                    >
                        <Pencil className="size-4" aria-hidden="true" />
                        Edit
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteOpen(true)}
                        disabled={blocked !== null}
                        title={blocked ?? undefined}
                    >
                        <Trash2 aria-hidden="true" />
                        <span className="sr-only">Delete collection</span>
                    </Button>
                </div>
            )}

            {/* Siblings of the menu — see the header. Rendered unconditionally: a closed Radix
                dialog portals nothing, so this costs a pair of empty roots and keeps the close
                animation that unmounting would cut off. */}
            <EditCollectionDialog
                collection={collection}
                open={editOpen}
                onOpenChange={setEditOpen}
            />
            <DeleteCollectionDialog
                collection={collection}
                open={deleteOpen}
                onOpenChange={setDeleteOpen}
                afterDeleteHref={afterDeleteHref}
            />
        </>
    );
}
