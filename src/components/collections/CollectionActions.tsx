"use client";

import { useState } from "react";
import { MoreHorizontal, Pencil, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";

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
    const [editOpen, setEditOpen] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);

    /**
     * Favoriting is not built yet — `Collection.isFavorite` is persisted and rendered, but nothing
     * writes it, and this feature was scoped to the control alone.
     *
     * A no-op that says so, rather than a disabled control: disabled reads as "not available to you"
     * and, in a dropdown, as a bug. A neutral toast (not success — nothing succeeded) is the honest
     * version, and the control keeps its place, its label, and its keyboard behaviour for the day the
     * write lands behind it.
     */
    const favorite = () => toast("Favoriting collections is coming soon.");

    const favoriteLabel = collection.isFavorite ? "Remove from favorites" : "Add to favorites";

    const star = (
        <Star
            className={cn(collection.isFavorite && "fill-yellow-400 text-yellow-400")}
            aria-hidden="true"
        />
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
                        <DropdownMenuItem onSelect={favorite}>
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
                    <Button variant="ghost" size="icon" onClick={favorite}>
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
