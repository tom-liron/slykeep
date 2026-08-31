import Link from "next/link";

import { TypeIcon } from "@/components/items/TypeIcon";
import { FavoriteBadge } from "@/components/ui/StatusBadges";
import type { CollectionViewModel } from "@/types/view-models";
import { CollectionActions } from "./CollectionActions";

/**
 * A collection on the dashboard and on `/collections`.
 *
 * The whole card used to *be* the link. It cannot be any more: the actions menu is a button, and a
 * button inside an anchor is invalid markup that a browser silently rewrites — the same failure as
 * the nested `<form>` that once left the resend-verification control unclickable. So the link is
 * stretched over the card instead (`absolute inset-0`), with the menu painted on top of it as a
 * later sibling, which is the layering `ItemList` already uses for its card overlays.
 *
 * The card stays a server component: only the menu needs `"use client"`, and it brings its own.
 */
export function CollectionCard({ collection }: { collection: CollectionViewModel }) {
    const accent = collection.dominantItemType?.color;

    return (
        <div
            className="relative flex flex-col rounded-xl border border-border border-l-4 bg-card p-4 transition-colors hover:bg-muted/50 focus-within:bg-muted/50"
            style={accent ? { borderLeftColor: accent } : undefined}
        >
            {/* Padded clear of the menu, which is laid over this row's right-hand end. */}
            <div className="flex items-center gap-1.5 pr-8">
                <h3 className="truncate font-semibold">{collection.name}</h3>
                {collection.isFavorite && <FavoriteBadge />}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
                {collection.itemCount} {collection.itemCount === 1 ? "item" : "items"}
            </p>
            {/* Guarded rather than always rendered: the view model normalizes a null description to
                "", and until collections could be created there was no way to have one — every
                seeded collection carries a description. The create dialog makes the field optional,
                so an empty paragraph (and its margin) is now reachable. */}
            {collection.description && (
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                    {collection.description}
                </p>
            )}
            <div className="mt-4 flex items-center gap-2">
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
                of its own. */}
            <Link
                href={`/collections/${collection.id}`}
                className="absolute inset-0 rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
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
