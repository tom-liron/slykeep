import "server-only";

import { prisma } from "@/server/infra/prisma";
import type { SearchDataViewModel } from "@/types/view-models";
import { getCurrentUserId } from "./current-user";
import { ITEM_SUMMARY_SELECT, toItemSummaries } from "./items";
import { getItemTypesById } from "./item-types";

/**
 * The command palette's prefetch: everything ⌘K matches against, read once per dashboard render.
 *
 * Search here is client-side. The dashboard layout calls {@link getSearchData}, serializes the
 * result into the palette's payload, and `lib/fuzzy-search.ts` does the matching and ranking in the
 * browser — so there is no search term on this side and no query per keystroke.
 *
 * @remarks
 * Item bodies are not searched. List queries never read `content`, so full-content search needs a
 * server-side query rather than a wider prefetch; matching is on titles, descriptions, tags and
 * types.
 */

/**
 * Upper bound on what the palette is given to search.
 *
 * @remarks
 * A ceiling on the payload rather than a product limit — the whole set is serialized into the
 * dashboard layout on every page view. Set at the 200 the item-type pages page by, well above the
 * free tier's 50-item cap; most recently edited first, so what falls off the end of a large Pro
 * library is its coldest part.
 */
const SEARCH_ITEM_LIMIT = 200;

/**
 * Everything the command palette matches against: the user's items as full card summaries, and their
 * collections as a name and a count.
 *
 * @remarks
 * The items are read through {@link ITEM_SUMMARY_SELECT}, the same column list every other list
 * query uses, which keeps this off the `content` column and means each row is already the shape
 * `ItemDrawer` opens on.
 *
 * Item types are not filtered by entitlement. `getItemTypePageData` gates a whole *page* behind
 * `canAccessItemType`, but an item that already exists belongs to the user whatever their plan is,
 * and hiding it from search would make a stashed file unreachable rather than un-createable.
 */
export async function getSearchData(): Promise<SearchDataViewModel> {
    const userId = await getCurrentUserId();

    const [itemRows, collectionRows, itemTypesById] = await Promise.all([
        prisma.item.findMany({
            where: { userId },
            // This ordering decides *which* items are searchable at all, not just what order they
            // arrive in, because the prefetch is capped by SEARCH_ITEM_LIMIT. Sorting by `editedAt`
            // puts the cut at the coldest end of the library, so what falls off is what the user has
            // not worked on.
            orderBy: { editedAt: "desc" },
            take: SEARCH_ITEM_LIMIT,
            select: ITEM_SUMMARY_SELECT,
        }),
        prisma.collection.findMany({
            where: { userId },
            orderBy: { updatedAt: "desc" },
            select: { id: true, name: true, _count: { select: { items: true } } },
        }),
        getItemTypesById(userId),
    ]);

    return {
        items: toItemSummaries(itemRows, itemTypesById),
        collections: collectionRows.map((row) => ({
            id: row.id,
            name: row.name,
            itemCount: row._count.items,
        })),
    };
}
