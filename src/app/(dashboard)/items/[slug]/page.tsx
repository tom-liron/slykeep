import { notFound } from "next/navigation";

import { ItemList } from "@/components/items/ItemList";
import { TypeIcon } from "@/components/items/TypeIcon";
import { EmptyState } from "@/components/ui/EmptyState";
import { getItemTypePageData } from "@/server/items";

export default async function ItemTypePage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const data = await getItemTypePageData(slug);

    if (!data) {
        notFound();
    }

    // Files read as a list, not a grid: they are compared by name, size, and date down a column, the
    // way every file manager shows them. This is the one route serving all seven types, so the choice
    // is made per type here rather than by changing what the page renders for everything.
    const asFileList = data.itemType.name === "file";

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
                    <h1 className="text-2xl font-bold">{data.itemType.label}</h1>
                    <p className="text-muted-foreground">
                        {data.items.length} {data.items.length === 1 ? "item" : "items"}
                    </p>
                </div>
            </header>

            {data.items.length > 0 ? (
                <ItemList
                    items={data.items}
                    variant={asFileList ? "file" : "card"}
                    className={
                        asFileList
                            ? "flex flex-col gap-2"
                            : "grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
                    }
                />
            ) : (
                <EmptyState message={`No ${data.itemType.label.toLowerCase()} yet.`} />
            )}
        </div>
    );
}
