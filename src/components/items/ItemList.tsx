"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";
import type { ItemSummaryViewModel } from "@/types/view-models";
import { FileRow } from "./FileRow";
import { ItemCard } from "./ItemCard";
import { ItemDrawer } from "./ItemDrawer";

/**
 * A list of item cards that open the detail drawer when clicked.
 *
 * The pages rendering it are server components, so the open/selected state has to live somewhere
 * else — this is that somewhere. `className` carries each page's own container classes (the
 * dashboard stacks, the type and collection pages use a grid), so wrapping a list in this changes
 * what a card does, never how the list is laid out.
 *
 * The trigger is an overlay button rather than the card itself: a `<button>` may only contain
 * phrasing content, and `ItemCard` renders an `<article>` with a heading inside it. Nesting those
 * would be invalid markup the parser silently rewrites — the same failure as the `<form>` inside a
 * `<form>` that left the resend-verification control unclickable. Keeping the card untouched also
 * means it still renders as plain markup anywhere a drawer is not wanted.
 *
 * `variant` picks what an entry looks like, never how the list is arranged — the container classes
 * still arrive as `className`. A file is described by its object rather than summarised by a body, so
 * the files page renders rows; everything else is a card.
 */
export function ItemList({
    items,
    className,
    variant = "card",
}: {
    items: ItemSummaryViewModel[];
    className?: string;
    variant?: "card" | "file";
}) {
    // Two pieces of state rather than one, so the drawer can animate out: `open` goes false on
    // close while `selected` keeps rendering the item until the transition finishes. Keying the
    // drawer by item id is what resets its fetch when a different card is clicked.
    const [selected, setSelected] = useState<ItemSummaryViewModel | null>(null);
    const [open, setOpen] = useState(false);

    const openItem = (item: ItemSummaryViewModel) => {
        setSelected(item);
        setOpen(true);
    };

    return (
        <>
            <div className={className}>
                {items.map((item) => (
                    <div key={item.id} className="relative">
                        {variant === "file" ? <FileRow item={item} /> : <ItemCard item={item} />}
                        <button
                            type="button"
                            onClick={() => openItem(item)}
                            className={cn(
                                "absolute inset-0 cursor-pointer transition-colors hover:bg-foreground/5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                                // Matched to the entry underneath, so the hover tint stops exactly
                                // where its border curves.
                                variant === "file" ? "rounded-lg" : "rounded-xl",
                            )}
                        >
                            <span className="sr-only">Open {item.title}</span>
                        </button>
                    </div>
                ))}
            </div>

            {selected && (
                <ItemDrawer
                    key={selected.id}
                    item={selected}
                    open={open}
                    onClose={() => setOpen(false)}
                />
            )}
        </>
    );
}
