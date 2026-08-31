import { notFound } from "next/navigation";

import { ItemList } from "@/components/items/ItemList";
import { ProTypeUpgrade } from "@/components/items/ProTypeUpgrade";
import { TypeIcon } from "@/components/items/TypeIcon";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { CARD_GRID, FILE_ROW_GRID } from "@/config/dashboard";
import { parsePageParam } from "@/lib/pagination";
import { getItemTypePageData } from "@/server/items";

export default async function ItemTypePage({
    params,
    searchParams,
}: {
    params: Promise<{ slug: string }>;
    searchParams: Promise<{ page?: string | string[] }>;
}) {
    const [{ slug }, { page }] = await Promise.all([params, searchParams]);
    const data = await getItemTypePageData(slug, parsePageParam(page));

    // Only an unknown slug is a 404 now. A Pro-gated type the account cannot open is a page about
    // the feature instead, which is the one place a free user meets it at the moment they want it.
    if (!data) {
        notFound();
    }

    if (data.locked) {
        return <ProTypeUpgrade itemType={data.itemType} />;
    }

    const { totalCount } = data.pagination;

    // Files read as a list, not a grid: they are compared by name, size, and date down a column, the
    // way every file manager shows them. Images go the other way — the content is the picture, so
    // they are browsed as a gallery of thumbnails. This is the one route serving all seven types, so
    // the choice is made per type here rather than by changing what the page renders for everything.
    const variant =
        data.itemType.name === "file" ? "file" : data.itemType.name === "image" ? "image" : "card";

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
                    {/* The whole type's count, not the page's — `data.items` is now one page of it. */}
                    <p className="text-muted-foreground">
                        {totalCount} {totalCount === 1 ? "item" : "items"}
                    </p>
                </div>
            </header>

            {data.items.length > 0 ? (
                <>
                    <ItemList
                        items={data.items}
                        variant={variant}
                        className={variant === "file" ? FILE_ROW_GRID : CARD_GRID}
                    />
                    <Pagination
                        pagination={data.pagination}
                        basePath={`/items/${data.itemType.slug}`}
                    />
                </>
            ) : (
                <EmptyState message={`No ${data.itemType.label.toLowerCase()} yet.`} />
            )}
        </div>
    );
}
