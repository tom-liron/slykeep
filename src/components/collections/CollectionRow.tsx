import Link from "next/link";
import { Folder } from "lucide-react";

import { formatDate } from "@/lib/format";
import type { FavoriteCollectionViewModel } from "@/types/view-models";

/**
 * One collection as a dense line — the collections half of `/favorites`, built to `ItemRow`'s
 * rhythm and columns so the two sections read as one list.
 *
 * A plain `<Link>`, not an overlaid trigger: a collection is a page, so a middle click or "copy
 * link address" work as expected. The folder icon takes the collection's dominant-type colour, the
 * same signal the card accent and sidebar dot carry, and is neutral when there is no dominant type.
 */
export function CollectionRow({ collection }: { collection: FavoriteCollectionViewModel }) {
    const accent = collection.dominantItemType?.color;

    return (
        <Link
            href={`/collections/${collection.id}`}
            className="flex items-center gap-3 rounded-md px-3 py-2 transition-colors pointer-coarse:py-3 hover:bg-foreground/5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
            <Folder
                className="size-4 shrink-0 text-muted-foreground"
                style={accent ? { color: accent } : undefined}
                aria-hidden="true"
            />

            <span className="min-w-0 flex-1 truncate font-mono text-sm">{collection.name}</span>

            {/* The same two-column block `ItemRow` ends with, at the same widths: the dates line up
                down the page, and the count sits where an item's type badge does — including
                hiding below `sm` as that badge does. The date stays at every width. */}
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
