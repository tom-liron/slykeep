"use client";

import { useState } from "react";
import { FolderPlus } from "lucide-react";

import { CreateCollectionDialog } from "./CreateCollectionDialog";

/**
 * The trailing cell of the collections grid: a dashed card that opens the create dialog.
 *
 * `/collections` had no create affordance of its own — the only way to make one was the top bar,
 * which is chrome shared by every page and so reads as belonging to none of them. On the page whose
 * whole subject is collections, the grid ending in a gap where the next card would go is where
 * someone looks for it.
 *
 * It drives `CreateCollectionDialog` in its controlled mode rather than reaching for a second
 * trigger, so this is a new *surface* for the create flow and not a second copy of it — same
 * dialog, same action, same validation, same toasts.
 *
 * Deliberately not hidden at the free tier's three-collection cap. The action is the authority on
 * limits (see `lib/limits.ts` and the note in the project overview), and it answers with an
 * upgrade-flavoured refusal — which is a better answer than a create affordance that silently stops
 * existing, since a missing button explains nothing about why. It is also what the top bar's own
 * "New Collection" already does, and the two must not disagree.
 */
export function NewCollectionCard() {
    const [open, setOpen] = useState(false);

    return (
        <>
            {/* `min-h-40` rather than a stretched cell: the grid's rows are sized by the tallest
                real card, and a button with two lines in it would otherwise collapse to those two
                lines and sit as a stub beside full-height neighbours. The floor is close to a
                populated card's natural height, and `h-full` lets it grow to match a taller row.

                Dashed and `bg-transparent` so it reads as a slot rather than as a collection — this
                is the one cell in the grid that is not a thing the user has made. */}
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="flex h-full min-h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-transparent p-4 text-muted-foreground transition-colors hover:border-foreground/30 hover:bg-muted/40 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
                <FolderPlus className="size-6" aria-hidden="true" />
                <span className="text-sm font-medium">New collection</span>
            </button>

            <CreateCollectionDialog open={open} onOpenChange={setOpen} />
        </>
    );
}
