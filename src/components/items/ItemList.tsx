"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";
import type { ItemSummaryViewModel } from "@/types/view-models";
import { CopyItemButton, copyableSourceFor } from "./CopyItemButton";
import { FileRow } from "./FileRow";
import { ImageCard } from "./ImageCard";
import { ItemCard } from "./ItemCard";
import { ItemDrawer } from "./ItemDrawer";
import { ItemRow } from "./ItemRow";

/**
 * The client wrapper that turns a server-rendered list of items into ones that open the detail
 * drawer when clicked.
 *
 * The pages rendering it are server components, so the open/selected drawer state lives here.
 * `className` carries each page's own container classes (the dashboard stacks; the type and
 * collection pages use a grid), and `variant` picks each entry's shape — `FileRow` for files,
 * `ImageCard` for images, `ItemRow` for the flat `/favorites` line, `ItemCard` otherwise. Neither
 * changes how the list is laid out.
 *
 * @remarks
 * The click target is an overlay `<button>` sibling, not the card itself: a `<button>` may only
 * contain phrasing content, and the entry components render an `<article>` with a heading. This
 * also keeps each entry component usable as plain markup where no drawer is wanted.
 */
export function ItemList({
    items,
    className,
    variant = "card",
}: {
    items: ItemSummaryViewModel[];
    className?: string;
    variant?: "card" | "file" | "image" | "row";
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
                {items.map((item) => {
                    // Asked here too, not only inside `CopyItemButton`: the card's timestamp shares
                    // the button's corner and fades out for it, so the card has to know whether a
                    // button will appear. A pure lookup over data in hand; the button still decides
                    // for itself.
                    const showsCopy = variant === "card" && copyableSourceFor(item) !== null;

                    return (
                        // `group` so an entry can react to the pointer at all: the trigger below
                        // covers it and is its sibling, not its parent, so the entry itself never
                        // matches `:hover` — the thumbnail's zoom is `group-hover`.
                        <div key={item.id} className="group relative">
                            {variant === "file" && <FileRow item={item} />}
                            {variant === "image" && <ImageCard item={item} />}
                            {variant === "row" && <ItemRow item={item} />}
                            {variant === "card" && <ItemCard item={item} showsCopy={showsCopy} />}
                            <button
                                type="button"
                                onClick={() => openItem(item)}
                                className={cn(
                                    "absolute inset-0 cursor-pointer transition-colors hover:bg-foreground/5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                                    // Matched to the entry underneath, so the hover tint stops
                                    // exactly where its border curves.
                                    variant === "file" && "rounded-lg",
                                    // A row has no border to curve around, so the tint is a plain
                                    // band across the list — the smallest radius that still softens
                                    // its ends.
                                    variant === "row" && "rounded-md",
                                    (variant === "card" || variant === "image") && "rounded-xl",
                                    // A thumbnail is already lit by its zoom, and a tint over a
                                    // picture reads as the image changing rather than the card
                                    // responding.
                                    variant === "image" && "hover:bg-transparent",
                                )}
                            >
                                <span className="sr-only">Open {item.title}</span>
                            </button>
                            {/* After the trigger in document order, not inside the card: the
                                trigger is `inset-0` and the two positioned siblings paint in order,
                                so this stays on top and clickable.

                                It sits over the card's timestamp, which fades out as this fades in,
                                so hover swaps the date for the action. `group-focus-within` gives
                                the keyboard the same swap. `pointer-coarse:opacity-100` makes it
                                always-on under a coarse pointer, which has no hover state to reveal
                                it — `ItemCard`'s timestamp is then always off, so the two never
                                overlap. Cards only: a file row and a gallery tile have no spare
                                corner. */}
                            {showsCopy && (
                                <CopyItemButton
                                    item={item}
                                    className="absolute top-3 right-3 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 pointer-coarse:opacity-100"
                                />
                            )}
                        </div>
                    );
                })}
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
