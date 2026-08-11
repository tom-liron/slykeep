import { CollectionRow } from "@/components/collections/CollectionRow";
import { ItemList } from "@/components/items/ItemList";
import { EmptyState } from "@/components/ui/EmptyState";
import { getFavoriteCollections } from "@/server/collections";
import { getFavoriteItems } from "@/server/items";

/**
 * Everything the user has starred, in one dense list.
 *
 * No session check here, and none is missing: `proxy.ts` denies by default, so every route in this
 * group is behind authentication before its page function runs, and both queries scope themselves to
 * `getCurrentUserId()` regardless. A page that re-checked would be stating a rule it does not enforce.
 *
 * The two reads are independent, so they go together rather than in sequence — the same shape the
 * dashboard uses for its own pair.
 */
export default async function FavoritesPage() {
    const [items, collections] = await Promise.all([getFavoriteItems(), getFavoriteCollections()]);

    const hasFavorites = items.length > 0 || collections.length > 0;

    return (
        // Narrower than the collections grid on purpose. A row is one line of text, and a line that
        // runs the full width of a desktop leaves the title stranded at one edge and its metadata at
        // the other — the width *is* the gap. 3xl keeps both ends of a row in one glance.
        <div className="mx-auto max-w-3xl space-y-6">
            <header>
                <h1 className="text-2xl font-bold">Favorites</h1>
                <p className="text-muted-foreground">
                    Everything you have starred, most recently updated first.
                </p>
            </header>

            {/* One empty state for the page, not one per section. Two dashed boxes saying "no
                favorite items" and "no favorite collections" is the same sentence twice on the only
                screen where both are true at once — and a section with a heading, a count of zero,
                and a placeholder under it is three ways of saying nothing is here. */}
            {hasFavorites ? (
                <div className="space-y-8">
                    {items.length > 0 && (
                        <section className="space-y-2">
                            <SectionHeading label="Items" count={items.length} />
                            <ListSurface>
                                <ItemList items={items} variant="row" />
                            </ListSurface>
                        </section>
                    )}

                    {collections.length > 0 && (
                        <section className="space-y-2">
                            <SectionHeading label="Collections" count={collections.length} />
                            <ListSurface>
                                {collections.map((collection) => (
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
 * A section's name and how many rows are under it. Small enough to live beside its only caller —
 * hoisting it to `components/ui` would be a shared component with one user and no second opinion
 * about what it should look like.
 */
function SectionHeading({ label, count }: { label: string; count: number }) {
    return (
        <h2 className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
            {label} ({count})
        </h2>
    );
}
