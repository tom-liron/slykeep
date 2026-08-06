"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";
import type { ItemSummaryViewModel } from "@/types/view-models";
import { CopyItemButton } from "./CopyItemButton";
import { FileRow } from "./FileRow";
import { ImageCard } from "./ImageCard";
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
 * the files page renders rows; an image *is* its object, so the images page renders thumbnails;
 * everything else is a card.
 */
export function ItemList({
    items,
    className,
    variant = "card",
}: {
    items: ItemSummaryViewModel[];
    className?: string;
    variant?: "card" | "file" | "image";
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
                    // `group` so an entry can react to the pointer at all: the trigger below covers
                    // it and is its sibling, not its parent, so the entry itself never matches
                    // `:hover` — the thumbnail's zoom is `group-hover`.
                    <div key={item.id} className="group relative">
                        {variant === "file" && <FileRow item={item} />}
                        {variant === "image" && <ImageCard item={item} />}
                        {variant === "card" && <ItemCard item={item} />}
                        <button
                            type="button"
                            onClick={() => openItem(item)}
                            className={cn(
                                "absolute inset-0 cursor-pointer transition-colors hover:bg-foreground/5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                                // Matched to the entry underneath, so the hover tint stops exactly
                                // where its border curves.
                                variant === "file" ? "rounded-lg" : "rounded-xl",
                                // A thumbnail is already lit by its zoom, and a tint over a picture
                                // reads as the image changing rather than the card responding.
                                variant === "image" && "hover:bg-transparent",
                            )}
                        >
                            <span className="sr-only">Open {item.title}</span>
                        </button>
                        {/* After the trigger, not inside the card: the trigger is `inset-0`, so
                            anything under it in the stack can never be clicked, and two positioned
                            siblings paint in document order — which is all the layering this needs.

                            It sits where the card's timestamp is, and the timestamp fades out as
                            this fades in, so hovering a card swaps the date for what you can do to
                            it. `group-focus-within` is what gives the same swap to the keyboard,
                            where focusing the trigger is the equivalent of pointing at the card.

                            Cards only. A file row and a gallery tile are different shapes with no
                            corner spare, and the request was for the item card; the button itself
                            already declines any item with nothing to copy. */}
                        {variant === "card" && (
                            <CopyItemButton
                                item={item}
                                className="absolute top-3 right-3 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
                            />
                        )}
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
