import { notFound } from "next/navigation";
import { Star } from "lucide-react";

import { CollectionActions } from "@/components/collections/CollectionActions";
import { ItemList } from "@/components/items/ItemList";
import { TypeIcon } from "@/components/items/TypeIcon";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { parsePageParam } from "@/lib/pagination";
import { getCollectionPageData } from "@/server/collections";

export default async function CollectionPage({
    params,
    searchParams,
}: {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ page?: string | string[] }>;
}) {
    const [{ id }, { page }] = await Promise.all([params, searchParams]);
    const data = await getCollectionPageData(id, parsePageParam(page));

    if (!data) {
        notFound();
    }

    const { itemCount } = data.collection;

    return (
        <div className="mx-auto max-w-6xl space-y-6">
            <header className="space-y-2">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                        <h1 className="truncate text-2xl font-bold">{data.collection.name}</h1>
                        {data.collection.isFavorite && (
                            <>
                                <Star
                                    className="size-4 shrink-0 fill-yellow-400 text-yellow-400"
                                    aria-hidden="true"
                                />
                                <span className="sr-only">Favorite collection</span>
                            </>
                        )}
                    </div>
                    {/* `afterDeleteHref` because this page is the one surface that cannot stay put:
                        the route 404s the moment the row is gone. */}
                    <CollectionActions
                        collection={data.collection}
                        layout="inline"
                        afterDeleteHref="/collections"
                        className="shrink-0"
                    />
                </div>
                {/* Guarded the way the card guards it: a null description is normalized to "", and an
                    empty paragraph would still take a row of the header's vertical rhythm. */}
                {data.collection.description && (
                    <p className="text-muted-foreground">{data.collection.description}</p>
                )}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-muted-foreground">
                    <span>
                        {itemCount} {itemCount === 1 ? "item" : "items"}
                    </span>
                    {data.itemTypeCounts.map((itemType) => (
                        <span key={itemType.id} className="flex items-center gap-1">
                            <TypeIcon
                                name={itemType.icon}
                                className="size-4"
                                style={{ color: itemType.color }}
                                aria-hidden="true"
                            />
                            {itemType.itemCount}
                            {/* The icon carries the type visually and is hidden from assistive tech,
                                so the label is what makes "3" mean "3 snippets" when read aloud. */}
                            <span className="sr-only">{itemType.label}</span>
                        </span>
                    ))}
                </div>
            </header>

            {data.items.length > 0 ? (
                <>
                    <ItemList
                        items={data.items}
                        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
                    />
                    <Pagination pagination={data.pagination} basePath={`/collections/${id}`} />
                </>
            ) : (
                <EmptyState message="This collection is empty." />
            )}
        </div>
    );
}
