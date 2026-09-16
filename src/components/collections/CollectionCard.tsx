import Link from "next/link";

import { TypeIcon } from "@/components/items/TypeIcon";
import { FavoriteBadge } from "@/components/ui/StatusBadges";
import { softAccent } from "@/lib/utils";
import type { CollectionViewModel } from "@/types/view-models";
import { CollectionActions } from "./CollectionActions";

/**
 * A collection card, on the dashboard and on `/collections`.
 *
 * The link is stretched over the card (`absolute inset-0`) with {@link CollectionActions}' menu
 * painted on top as a later sibling, because a `<button>` inside an `<a>` is invalid markup. This
 * is the overlay layering `ItemList` uses for its cards.
 *
 * The card stays a server component; only the menu is `"use client"`, and it brings its own.
 */
export function CollectionCard({ collection }: { collection: CollectionViewModel }) {
    const accent = collection.dominantItemType?.color;

    return (
        <div
            className="group relative flex flex-col rounded-xl border border-border border-l-4 bg-card p-4"
            style={accent ? { borderLeftColor: softAccent(accent) } : undefined}
        >
            {/* Padded clear of the menu laid over the row's right-hand end. `CollectionActions`
                renders it at `size="icon-sm"` (28px with a mouse, 44px on a coarse pointer), so
                the `pr` clearance covers both. `pointer-coarse:` rather than a breakpoint, since a
                touchscreen laptop has the 44px button at any width. */}
            <div className="flex items-center gap-1.5 pr-8 pointer-coarse:pr-12">
                <h3 className="truncate font-semibold">{collection.name}</h3>
                {collection.isFavorite && <FavoriteBadge />}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
                {collection.itemCount} {collection.itemCount === 1 ? "item" : "items"}
            </p>
            {/* Always rendered, and always two lines tall, even when the description is "" — the view
                model normalizes null to that and the create dialog makes the field optional. Together
                with the icon row below, this is what gives every card one height.

                A grid stretches its children, so cards *within* a row already matched; cards in
                different rows did not, because each row sizes to its own tallest. The description was
                0, 1 or 2 lines and the icon row 0 or 16px, so a row holding a long description stood
                visibly taller than the row under it. `ItemCard` fixed the same defect the same way,
                by pinning its tag row to one line rather than by stretching the container.

                Sized in `rem` against `text-sm`'s own line height, so it tracks a raised browser font
                size instead of clipping at one. */}
            <p className="mt-2 line-clamp-2 min-h-10 text-sm text-muted-foreground">
                {collection.description}
            </p>
            {/* `min-h-4` matches the `size-4` icons, holding the row open for a collection that has
                no items yet. */}
            <div className="mt-4 flex min-h-4 items-center gap-2">
                {collection.itemTypes.map((itemType) => (
                    <TypeIcon
                        key={itemType.id}
                        name={itemType.icon}
                        className="size-4"
                        style={{ color: itemType.color }}
                        aria-hidden="true"
                    />
                ))}
            </div>

            {/* Covers the card, so clicking anywhere that is not the menu opens the collection. It
                carries the accessible name on its own, which is why the heading above needs no link
                of its own.

                The hover tint rides on this overlay, not on the card, because `bg-card` is opaque:
                a `hover:` background on the card *replaces* it rather than tinting it, which in
                dark mode lands within `oklch(0.002)` of the resting colour. Layered on top, the
                `foreground/5` the item cards use reads in both themes. `group-*` rather than
                `hover:` keeps the card lit while the pointer is on the actions menu above it. */}
            <Link
                href={`/collections/${collection.id}`}
                className="absolute inset-0 rounded-xl transition-colors group-hover:bg-foreground/5 group-focus-within:bg-foreground/5 focus-glow"
            >
                <span className="sr-only">{collection.name}</span>
            </Link>

            {/* After the link in document order, so it paints above it — two positioned siblings
                stack in source order, which is all the layering this needs. */}
            <CollectionActions
                collection={collection}
                layout="menu"
                className="absolute top-2.5 right-2.5"
            />
        </div>
    );
}
