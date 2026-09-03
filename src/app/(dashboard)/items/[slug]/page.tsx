import { notFound } from "next/navigation";

import { ItemList } from "@/components/items/ItemList";
import { ProTypeUpgrade } from "@/components/items/ProTypeUpgrade";
import { TypeIcon } from "@/components/items/TypeIcon";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { CARD_GRID, FILE_ROW_GRID } from "@/config/dashboard";
import { parsePageParam } from "@/lib/pagination";
import { getItemTypePageData } from "@/server/items";

/**
 * The item-type listing at `/items/<slug>` — one route for all seven system types.
 *
 * `getItemTypePageData` resolves the slug, scopes the read to the user, and paginates. An unknown
 * slug is a 404; a Pro-gated type a free account cannot open renders `ProTypeUpgrade` instead. The
 * page chooses a list variant per type — files as a column, images as a gallery, everything else as
 * cards — so the one route serves them all.
 */
export default async function ItemTypePage({
    params,
    searchParams,
}: {
    params: Promise<{ slug: string }>;
    searchParams: Promise<{ page?: string | string[] }>;
}) {
    const [{ slug }, { page }] = await Promise.all([params, searchParams]);
    const data = await getItemTypePageData(slug, parsePageParam(page));

    // An unknown slug is a 404; a Pro-gated type the account cannot open is handled below as a page
    // about the feature, not a 404.
    if (!data) {
        notFound();
    }

    if (data.locked) {
        return <ProTypeUpgrade itemType={data.itemType} />;
    }

    const { totalCount } = data.pagination;

    // Files as a column, compared by name, size and date the way a file manager shows them; images
    // as a gallery, since the content is the picture; everything else as cards. Chosen per type
    // here because this one route serves all seven.
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
                    {/* The whole type's count, not the page's — `data.items` is one page of it. */}
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
