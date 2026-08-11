import { FavoritesView } from "@/components/favorites/FavoritesView";
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
 *
 * What is left here is the data boundary and the page's width; everything rendered is `FavoritesView`,
 * which is a client component because ordering rows already in hand is a preference, not a query.
 * The heading went with it: the sort control sits on the heading's line, and it cannot be separated
 * from the state it drives.
 */
export default async function FavoritesPage() {
    const [items, collections] = await Promise.all([getFavoriteItems(), getFavoriteCollections()]);

    return (
        // Narrower than the collections grid on purpose. A row is one line of text, and a line that
        // runs the full width of a desktop leaves the title stranded at one edge and its metadata at
        // the other — the width *is* the gap. 3xl keeps both ends of a row in one glance.
        <div className="mx-auto max-w-3xl">
            <FavoritesView items={items} collections={collections} />
        </div>
    );
}
