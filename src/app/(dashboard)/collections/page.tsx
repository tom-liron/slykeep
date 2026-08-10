import { CollectionCard } from "@/components/collections/CollectionCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
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
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {collections.map((collection) => (
                            <CollectionCard key={collection.id} collection={collection} />
                        ))}
                    </div>
                    <Pagination pagination={pagination} basePath="/collections" />
                </>
            ) : (
                <EmptyState message="No collections yet." />
            )}
        </div>
    );
}
