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
 * Everything on `/favorites` below the route boundary: the heading, the sort control, and the two
 * lists the control orders.
 *
 * It holds the heading rather than leaving it on the page because the control sits *in line with*
 * it, and the control cannot be lifted out of the component holding the sort state. The alternative
 * — the page keeping an `<h1>` for its empty branch while this renders another for its full one —
 * puts the same heading in two files and waits for them to disagree.
 *
 * So the empty state lives here too, which is what keeps the control honest: it renders only when
 * there is something to sort. A sort dropdown above "No favorites yet" is a control over nothing.
 *
 * One control for both sections rather than one each. The two are deliberately a single list with a
 * heading in the middle (`CollectionRow` exists so they share a rhythm), and a page that could be
 * showing items by name above collections by date would undo that in the one place it matters.
 *
 * It opens on `DEFAULT_FAVORITE_SORT`, which is the order the server already returned — so the first
 * client render reproduces the server's markup exactly and nothing jumps on hydration.
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
     * Rendered into the first section's heading rather than beside the page title.
     *
     * It orders both sections, so the page heading is where it nominally belongs — but that line is
     * a long way above the rows it reorders, and a control that far from its effect reads as chrome
     * belonging to the title. On the first section's line it sits directly over the list it acts on.
     *
     * The cost is that it ends up *inside* one `<section>` while governing both, which is a small
     * semantic fib worth naming: assistive technology announces it within the Items region. It stays
     * one control either way — the alternative, one per section, is what `FavoritesView`'s own note
     * about a single list with a heading in the middle rules out.
     */
    const sortControl = <FavoritesSortControl sort={sort} onSortChange={setSort} />;

    return (
        <div>
            {/* Outline, and leading — both by the rule the rest of the app's stars follow. This one
                names the page rather than asserting that anything is favourited, so it is a noun and
                stays hollow; a filled star here would be the app claiming "Favorites" is itself
                favourited. Leading for the same reason: an icon before a heading labels it, while a
                star *after* a name is the badge that says that particular thing is starred, which is
                what the collection page's title does. Same icon and same side as the sidebar's
                Favorites row, because they are the same destination. */}
            <h1 className="mb-4 flex items-center gap-2 text-2xl font-bold">
                <Star className="size-6 shrink-0 text-favorite" aria-hidden="true" />
                Favorites
            </h1>

            {/* One empty state for the page, not one per section. Two dashed boxes saying "no
                favorite items" and "no favorite collections" is the same sentence twice on the only
                screen where both are true at once — and a section with a heading, a count of zero,
                and a placeholder under it is three ways of saying nothing is here. */}
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
 * The card the rows of one section sit on.
 *
 * The rows themselves stay flat — no per-row card, no dividers — but a list of them floating
 * straight on the page background had nothing holding it together, and the hover band was the only
 * surface in the whole list. One raised surface per section fixes both: the block reads as a single
 * object, and `bg-card` gives the hover something to be lighter *than* (`0.205` against the page's
 * `0.145` in dark mode, with the hover tint on top of that).
 *
 * `p-1` rather than `p-0`, so the hover band is inset from the border instead of painting over its
 * corners — the rows keep their own `px-3`, which is what the band's width comes from.
 */
function ListSurface({ children }: { children: React.ReactNode }) {
    return <div className="rounded-xl border border-border bg-card p-1">{children}</div>;
}

/**
 * A section's name, how many rows are under it, and — on the first section only — the sort control.
 *
 * Small enough to live beside its only caller: hoisting it to `components/ui` would be a shared
 * component with one user and no second opinion about what it should look like.
 *
 * `items-end` is what puts the label and the control on one ground. The label is 16px of line box
 * against a 28px button, so the row's height comes from the button and centring would leave the
 * label floating in the middle of it rather than standing on the same line.
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
