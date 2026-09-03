"use client";

import { useMemo, useState } from "react";

import { Star } from "lucide-react";

import { CollectionRow } from "@/components/collections/CollectionRow";
import { ItemList } from "@/components/items/ItemList";
import { EmptyState } from "@/components/ui/EmptyState";
import {
    collectionSortFields,
    DEFAULT_FAVORITE_SORT,
    itemSortFields,
    sortFavorites,
    type FavoriteSort,
} from "@/lib/favorites-sort";
import type { FavoriteCollectionViewModel, ItemSummaryViewModel } from "@/types/view-models";

import { FavoritesSortControl } from "./FavoritesSortControl";

/**
 * Everything on `/favorites` below the route boundary: the page heading, the sort control, the two
 * lists it orders, and the empty state.
 *
 * A client component because the sort is client-side ({@link FavoritesSortControl} sits in a
 * section heading, so this owns the heading and the empty state too). One sort control governs both
 * sections, so favourite items and favourite collections stay one list with a heading in the
 * middle.
 *
 * Opens on `DEFAULT_FAVORITE_SORT`, the order the server returned, so the first client render
 * matches the server markup.
 */
export function FavoritesView({
    items,
    collections,
}: {
    items: ItemSummaryViewModel[];
    collections: FavoriteCollectionViewModel[];
}) {
    const [sort, setSort] = useState<FavoriteSort>(DEFAULT_FAVORITE_SORT);

    // Memoised on the arrays as well as the sort: a `router.refresh()` after a star is toggled hands
    // down new arrays, and that has to re-sort. Re-sorting when neither changed does not.
    const sortedItems = useMemo(() => sortFavorites(items, sort, itemSortFields), [items, sort]);
    const sortedCollections = useMemo(
        () => sortFavorites(collections, sort, collectionSortFields),
        [collections, sort],
    );

    const showsItems = sortedItems.length > 0;
    const hasFavorites = showsItems || sortedCollections.length > 0;

    /**
     * The one sort control, rendered into the first visible section's heading so it sits directly
     * over the list it acts on rather than beside the far-away page title. It governs both sections
     * from inside one `<section>`, so assistive technology announces it within that region.
     */
    const sortControl = <FavoritesSortControl sort={sort} onSortChange={setSort} />;

    return (
        <div>
            {/* Outline and leading, by the app-wide star rule (see `CollectionActions`): this one
                names the page, so it is hollow and before the heading, matching the sidebar's
                Favorites row. */}
            <h1 className="mb-4 flex items-center gap-2 text-2xl font-bold">
                <Star className="size-6 shrink-0 text-favorite" aria-hidden="true" />
                Favorites
            </h1>

            {/* One empty state for the page, not one per section. */}
            {hasFavorites ? (
                <div className="space-y-8">
                    {showsItems && (
                        <section className="space-y-2">
                            <SectionHeading
                                label="Items"
                                count={sortedItems.length}
                                action={sortControl}
                            />
                            <ListSurface>
                                <ItemList items={sortedItems} variant="row" />
                            </ListSurface>
                        </section>
                    )}

                    {sortedCollections.length > 0 && (
                        <section className="space-y-2">
                            <SectionHeading
                                label="Collections"
                                count={sortedCollections.length}
                                // Only when it has not already been rendered above: the control
                                // belongs to whichever section comes first, because that is the line
                                // it has to sit on, and a page of collections alone has no other.
                                action={showsItems ? undefined : sortControl}
                            />
                            <ListSurface>
                                {sortedCollections.map((collection) => (
                                    <CollectionRow key={collection.id} collection={collection} />
                                ))}
                            </ListSurface>
                        </section>
                    )}
                </div>
            ) : (
                <EmptyState message="No favorites yet. Star an item or a collection to find it here." />
            )}
        </div>
    );
}

/**
 * The raised `bg-card` surface one section's flat rows sit on, so the list reads as one object and
 * a row's hover tint has something lighter to sit against.
 *
 * `p-1`, not `p-0`, so the hover band is inset from the rounded border; the rows keep their own
 * `px-3`.
 */
function ListSurface({ children }: { children: React.ReactNode }) {
    return <div className="rounded-xl border border-border bg-card p-1">{children}</div>;
}

/**
 * A section's name, its row count, and — on the first section only — the `action` slot the sort
 * control fills.
 *
 * `items-end` sits the label on the same baseline as the taller button, rather than centring it in
 * the button's height.
 */
function SectionHeading({
    label,
    count,
    action,
}: {
    label: string;
    count: number;
    action?: React.ReactNode;
}) {
    return (
        <div className="flex items-end justify-between gap-4">
            <h2 className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                {label} ({count})
            </h2>
            {action}
        </div>
    );
}
