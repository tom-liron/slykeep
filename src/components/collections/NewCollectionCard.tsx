"use client";

import { useState } from "react";
import { FolderPlus } from "lucide-react";

import { CreateCollectionDialog } from "./CreateCollectionDialog";

/**
 * The trailing cell of the collections grid: a dashed card that opens the create dialog.
 *
 * Gives `/collections` a create affordance on the page itself, where someone looks for it, rather
 * than only in the shared top bar. Drives {@link CreateCollectionDialog} in its controlled mode —
 * one more surface for the same flow, not a second copy.
 *
 * @remarks
 * Not hidden at the free tier's three-collection cap: the create action is the authority on limits
 * and answers with an upgrade-flavoured refusal, which the top bar's "New Collection" does too. A
 * missing button would explain nothing.
 */
export function NewCollectionCard() {
    const [open, setOpen] = useState(false);

    return (
        <>
            {/* `min-h-40` near a populated card's natural height, with `h-full` to grow to a
                taller row, so this does not sit as a two-line stub beside full-height neighbours.
                Dashed and `bg-transparent` so it reads as an empty slot, not a collection. */}
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="flex h-full min-h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-transparent p-4 text-muted-foreground transition-colors hover:border-foreground/30 hover:bg-muted/40 hover:text-foreground focus-glow"
            >
                <FolderPlus className="size-6" aria-hidden="true" />
                <span className="text-sm font-medium">New collection</span>
            </button>

            <CreateCollectionDialog open={open} onOpenChange={setOpen} />
        </>
    );
}
