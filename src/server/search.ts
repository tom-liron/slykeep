import "server-only";

import { prisma } from "@/lib/prisma";
import type { SearchDataViewModel } from "@/types/view-models";
import { getCurrentUserId } from "./current-user";
import { ITEM_SUMMARY_SELECT } from "./items";
import { getItemTypesById } from "./item-types";
import { buildItemSummaryViewModel } from "./view-models";

/**
 * Defensive upper bound on what the palette is given to search.
 *
 * The whole set is serialized into the dashboard layout's payload on every page view, so this is a
 * ceiling on that payload rather than a product limit — set at the same 200 the item-type pages use,
 * well above the free tier's 50-item cap. Most recently updated first, so if a Pro library ever does
 * exceed it, what falls off the end is the coldest part of it.
 */
const SEARCH_ITEM_LIMIT = 200;

/**
 * Everything the command palette matches against: the user's items as full card summaries, and their
 * collections as a name and a count.
 *
 * Search is client-side, so this is a prefetch and not a query per keystroke — there is no search
 * term here at all. The item bodies stay out of it: `ITEM_SUMMARY_SELECT` is the same column list
 * every other list query reads, which keeps this off the large `content` column and means the rows
 * are already the shape `ItemDrawer` opens on.
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
            // Not just a display order: the prefetch is capped, so this decides *which* items are
            // searchable at all. `editedAt` keeps that cut on the ones actually being worked on
            // rather than on whatever was starred last.
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
        items: itemRows.map((row) =>
            buildItemSummaryViewModel(
                { ...row, tags: row.tags.map((tag) => tag.name) },
                itemTypesById,
            ),
        ),
        collections: collectionRows.map((row) => ({
            id: row.id,
            name: row.name,
            itemCount: row._count.items,
        })),
    };
}
