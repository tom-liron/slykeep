import { notFound } from "next/navigation";

import { ItemCard } from "@/components/items/ItemCard";
import { TypeIcon } from "@/components/items/TypeIcon";
import { getItemTypePageData } from "@/server/mock-data/queries";

export default async function ItemTypePage({ params }: { params: Promise<{ type: string }> }) {
    const { type } = await params;
    const data = await getItemTypePageData(type);

    if (!data) {
        notFound();
    }

    return (
        <div className="mx-auto max-w-6xl space-y-6">
            <header className="flex items-start gap-3">
                <span
                    className="mt-0.5 flex size-10 items-center justify-center rounded-lg bg-card"
                    style={{ color: data.itemType.color }}
                >
                    <TypeIcon name={data.itemType.icon} className="size-5" aria-hidden="true" />
                </span>
                <div>
                    <h1 className="text-2xl font-bold">{data.itemType.name}</h1>
                    <p className="text-muted-foreground">
                        {data.items.length} {data.items.length === 1 ? "item" : "items"}
                    </p>
                </div>
            </header>

            {data.items.length > 0 ? (
                <div className="space-y-3">
                    {data.items.map((item) => (
                        <ItemCard key={item.id} item={item} />
                    ))}
                </div>
            ) : (
                <p className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                    No {data.itemType.name.toLowerCase()} yet.
                </p>
            )}
        </div>
    );
}
