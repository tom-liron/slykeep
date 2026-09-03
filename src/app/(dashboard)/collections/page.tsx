import { CollectionCard } from "@/components/collections/CollectionCard";
import { NewCollectionCard } from "@/components/collections/NewCollectionCard";
import { Pagination } from "@/components/ui/Pagination";
import { CARD_GRID } from "@/config/dashboard";
import { parsePageParam } from "@/lib/pagination";
import { getCollections } from "@/server/collections";

/**
 * The paginated grid of every collection the user owns, at `/collections`.
 *
 * `NewCollectionCard` trails the grid on the last page only, and stands in as the empty state when
 * there are no collections at all.
 */
export default async function CollectionsPage({
    searchParams,
}: {
    searchParams: Promise<{ page?: string | string[] }>;
}) {
    const { page } = await searchParams;
    const { collections, pagination } = await getCollections(parsePageParam(page));

    return (
        <div className="mx-auto max-w-6xl space-y-6">
            <header>
                <h1 className="text-2xl font-bold">Collections</h1>
                <p className="text-muted-foreground">Browse all of your saved collections.</p>
            </header>

            {collections.length > 0 ? (
                <>
                    <div className={CARD_GRID}>
                        {collections.map((collection) => (
                            <CollectionCard key={collection.id} collection={collection} />
                        ))}
                        {/* Last page only: it belongs after the collections, and mid-list on page 2
                            of 5 it is a hole in the grid rather than an affordance. */}
                        {pagination.page === pagination.pageCount && <NewCollectionCard />}
                    </div>
                    <Pagination pagination={pagination} basePath="/collections" />
                </>
            ) : (
                // The card is the empty state: a "No collections yet." message above an empty
                // "New collection" slot is the same sentence twice, and the slot alone says both
                // that there is nothing here and where the first one goes — while keeping the zero
                // case from being the one state with no way to create a collection.
                <div className={CARD_GRID}>
                    <NewCollectionCard />
                </div>
            )}
        </div>
    );
}
