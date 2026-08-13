import Link from "next/link";
import { Folder } from "lucide-react";

import { formatDate } from "@/lib/format";
import type { FavoriteCollectionViewModel } from "@/types/view-models";

/**
 * One collection as a dense line, the twin of `ItemRow` — same rhythm, same columns, so the two
 * sections of `/favorites` read as one list with a heading in the middle rather than two designs.
 *
 * A link rather than an overlaid trigger. An item needs the trigger because opening it is a drawer
 * rather than a destination, and `ItemCard` is markup a `<button>` may not legally contain; a
 * collection is a page, so this is the plain anchor that a middle click, a modifier click, and "copy
 * link address" all already know what to do with.
 *
 * The folder takes the collection's dominant type colour, which is the same signal its card's accent
 * and its sidebar dot carry. A collection with no items and no default type has no dominant type, and
 * gets the neutral icon rather than a colour standing in for one.
 */
export function CollectionRow({ collection }: { collection: FavoriteCollectionViewModel }) {
    const accent = collection.dominantItemType?.color;

    return (
        <Link
            href={`/collections/${collection.id}`}
            className="flex items-center gap-3 rounded-md px-3 py-2 transition-colors hover:bg-foreground/5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
            <Folder
                className="size-4 shrink-0 text-muted-foreground"
                style={accent ? { color: accent } : undefined}
                aria-hidden="true"
            />

            <span className="min-w-0 flex-1 truncate font-mono text-sm">{collection.name}</span>

            {/* The same two-column block `ItemRow` ends with, at the same widths — so the dates line
                up down the whole page and the count sits where an item's type badge does. Which is
                also why the count hides below `sm` exactly as that badge does: the two lists are
                the two halves of `/favorites` and are built to one rhythm, so a phone that dropped a
                column from one and not the other would break the very thing the shared widths are
                for. The date stays in both. */}
            <div className="flex shrink-0 items-center gap-3">
                <span className="hidden w-20 text-right text-xs text-muted-foreground sm:inline">
                    {collection.itemCount} {collection.itemCount === 1 ? "item" : "items"}
                </span>

                <time
                    dateTime={collection.updatedAt}
                    className="w-14 text-right font-mono text-xs text-muted-foreground"
                >
                    {formatDate(collection.updatedAt)}
                </time>
            </div>
        </Link>
    );
}
