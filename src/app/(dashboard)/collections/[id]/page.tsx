import { notFound } from "next/navigation";
import { Star } from "lucide-react";

import { ItemList } from "@/components/items/ItemList";
import { TypeIcon } from "@/components/items/TypeIcon";
import { EmptyState } from "@/components/ui/EmptyState";
import { getCollectionPageData } from "@/server/collections";

export default async function CollectionPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const data = await getCollectionPageData(id);

    if (!data) {
        notFound();
    }

    const { itemCount } = data.collection;

    return (
        <div className="mx-auto max-w-6xl space-y-6">
            <header className="space-y-2">
                <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-bold">{data.collection.name}</h1>
                    {data.collection.isFavorite && (
                        <>
                            <Star
                                className="size-4 fill-yellow-400 text-yellow-400"
                                aria-hidden="true"
                            />
                            <span className="sr-only">Favorite collection</span>
                        </>
                    )}
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
                <ItemList items={data.items} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" />
            ) : (
                <EmptyState message="This collection is empty." />
            )}
        </div>
    );
}
