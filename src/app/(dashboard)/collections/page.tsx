import { CollectionCard } from "@/components/collections/CollectionCard";
import { NewCollectionCard } from "@/components/collections/NewCollectionCard";
import { Pagination } from "@/components/ui/Pagination";
import { CARD_GRID } from "@/config/dashboard";
import { parsePageParam } from "@/lib/pagination";
import { getCollections } from "@/server/collections";

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
                        {/* Last page only. It belongs *after* the collections, and on page 2 of 5
                            "after" is the middle of the list — a create slot sitting between two
                            pages of real cards is a hole in the grid, not an affordance. */}
                        {pagination.page === pagination.pageCount && <NewCollectionCard />}
                    </div>
                    <Pagination pagination={pagination} basePath="/collections" />
                </>
            ) : (
                // The card *is* the empty state here, rather than sitting under one. Two dashed
                // boxes — "No collections yet." above an empty slot saying "New collection" — is the
                // same sentence twice, which is the objection `FavoritesView` already makes about
                // one empty state per section. The slot says both things at once: nothing here, and
                // this is where the first one goes.
                //
                // It also keeps the zero case from being the one state with no way to create a
                // collection, which is what adding the card to the populated grid alone would have
                // produced.
                <div className={CARD_GRID}>
                    <NewCollectionCard />
                </div>
            )}
        </div>
    );
}
