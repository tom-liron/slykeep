import { FavoritesView } from "@/components/favorites/FavoritesView";
import { getFavoriteCollections } from "@/server/collections";
import { getFavoriteItems } from "@/server/items";

/**
 * `/favorites` — every starred item and collection, in one dense list.
 *
 * This page is the data boundary and the page width only. `proxy.ts` has already required a
 * session, and both queries scope to `getCurrentUserId()`, so there is no check here. The two
 * reads run in parallel, as on the dashboard. Everything rendered is `FavoritesView`, a client
 * component, because ordering rows already in hand is a preference rather than a query — and the
 * heading lives there too, since the sort control sits on its line.
 */
export default async function FavoritesPage() {
    const [items, collections] = await Promise.all([getFavoriteItems(), getFavoriteCollections()]);

    return (
        // Narrower than the collections grid: a row is one line of text, and at full desktop width
        // its title and metadata sit at opposite edges. `3xl` keeps both ends in one glance.
        <div className="mx-auto max-w-3xl">
            <FavoritesView items={items} collections={collections} />
        </div>
    );
}
