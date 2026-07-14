import { notFound } from "next/navigation";
import { Star } from "lucide-react";

import { ItemCard } from "@/components/items/ItemCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { getCollectionPageData } from "@/server/collections";

export default async function CollectionPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const data = await getCollectionPageData(id);

    if (!data) {
        notFound();
    }

    return (
        <div className="mx-auto max-w-6xl space-y-6">
            <header>
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
                <p className="text-muted-foreground">{data.collection.description}</p>
            </header>

            {data.items.length > 0 ? (
                <div className="space-y-3">
                    {data.items.map((item) => (
                        <ItemCard key={item.id} item={item} />
                    ))}
                </div>
            ) : (
                <EmptyState message="This collection is empty." />
            )}
        </div>
    );
}
