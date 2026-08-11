"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Pencil, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { toggleCollectionFavorite } from "@/actions/collections";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { CollectionActionTarget } from "@/types/collection";
import { DeleteCollectionDialog } from "./DeleteCollectionDialog";
import { EditCollectionDialog } from "./EditCollectionDialog";

/**
 * Edit, delete, and favorite for one collection, in the two shapes the app needs them.
 *
 * One component rather than two, because the part worth sharing is not the buttons — it is the state
 * behind them. Both dialogs are controlled and both are rendered here as *siblings* of the trigger,
 * which is what makes the card's menu work at all: a Radix menu closes on select and unmounts its
 * items, so a dialog nested inside a `DropdownMenuItem` is torn down in the same frame it opens.
 * Hoisting `editOpen` / `deleteOpen` to the component that owns both layouts solves that once.
 *
 * `layout` chooses the shape and nothing else:
 * - `"menu"` — the three-dot control on a card, where the rest of the card is a link to the
 *   collection and only this may swallow a click.
 * - `"inline"` — the row of buttons in the collection page's header, where there is room to name
 *   what each one does and no link to compete with.
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
                toast.error(result.error);

                return;
            }

            // From what came back, not from `next`: the star follows the row, so it cannot end up
            // filled over a collection the write left alone.
            setWritten(result.data.isFavorite);
            toast.success(
                result.data.isFavorite ? "Added to favorites." : "Removed from favorites.",
            );

            // The action revalidates the layout, which re-renders the sidebar's favourites; this is
            // what re-renders the page under it — the card's own star, and the collection's header.
            router.refresh();
        });
    };

    const favoriteLabel = isFavorite ? "Remove from favorites" : "Add to favorites";

    const star = (
        <Star className={cn(isFavorite && "fill-yellow-400 text-yellow-400")} aria-hidden="true" />
    );

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
                        <DropdownMenuItem onSelect={() => setEditOpen(true)}>
                            <Pencil aria-hidden="true" />
                            Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={favorite} disabled={isFavoriting}>
                            {star}
                            {favoriteLabel}
                        </DropdownMenuItem>

                        <DropdownMenuSeparator />

                        <DropdownMenuItem
                            variant="destructive"
                            onSelect={() => setDeleteOpen(true)}
                        >
                            <Trash2 aria-hidden="true" />
                            Delete
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            ) : (
                <div className={cn("flex items-center gap-1", className)}>
                    <Button variant="ghost" size="icon" onClick={favorite} disabled={isFavoriting}>
                        {star}
                        <span className="sr-only">{favoriteLabel}</span>
                    </Button>
                    <Button variant="outline" onClick={() => setEditOpen(true)}>
                        <Pencil className="size-4" aria-hidden="true" />
                        Edit
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteOpen(true)}
                    >
                        <Trash2 aria-hidden="true" />
                        <span className="sr-only">Delete collection</span>
                    </Button>
                </div>
            )}

            {/* Outside the menu on purpose — see the note above. Rendered unconditionally rather
                than behind their own flags: a closed Radix dialog portals nothing, so this costs a
                pair of empty roots and keeps the close animation that unmounting would cut off. */}
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
