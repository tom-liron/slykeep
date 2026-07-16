import "server-only";

import { Prisma } from "@/generated/prisma-client/client";
import { prisma } from "@/lib/prisma";
import type { DashboardItemsViewModel } from "@/types/view-models";
import { getCurrentUserId } from "./current-user";
import { getItemTypesById } from "./item-types";
import { buildItemSummaryViewModel } from "./view-models";

/**
 * Only the columns a card reads — never an item body (`content` / `url` / `fileUrl`), which keeps
 * list queries off the large content columns. `tags` is joined as names, flattened below.
 */
const ITEM_SUMMARY_SELECT = {
    id: true,
    title: true,
    description: true,
    itemTypeId: true,
    isFavorite: true,
    isPinned: true,
    updatedAt: true,
    tags: { select: { name: true } },
} as const;

type ItemSummaryRow = Prisma.ItemGetPayload<{ select: typeof ITEM_SUMMARY_SELECT }>;

/** How many recent (non-pinned) items the dashboard lists. */
const RECENT_ITEMS_LIMIT = 10;

/**
 * The dashboard's pinned + recent item lists and the two item stat cards. Totals come from
 * `count()` rather than the length of a full item load, and the lists carry no item bodies — the
 * same shape the collection read path settled on.
 */
export async function getDashboardItems(): Promise<DashboardItemsViewModel> {
    const userId = await getCurrentUserId();

    const [pinnedRows, recentRows, totalItems, favoriteItems, itemTypesById] = await Promise.all([
        prisma.item.findMany({
            where: { userId, isPinned: true },
            orderBy: { updatedAt: "desc" },
            select: ITEM_SUMMARY_SELECT,
        }),
        prisma.item.findMany({
            where: { userId, isPinned: false },
            orderBy: { updatedAt: "desc" },
            take: RECENT_ITEMS_LIMIT,
            select: ITEM_SUMMARY_SELECT,
        }),
        prisma.item.count({ where: { userId } }),
        prisma.item.count({ where: { userId, isFavorite: true } }),
        getItemTypesById(userId),
    ]);

    const toViewModel = (row: ItemSummaryRow) =>
        buildItemSummaryViewModel({ ...row, tags: row.tags.map((tag) => tag.name) }, itemTypesById);

    return {
        totalItems,
        favoriteItems,
        pinnedItems: pinnedRows.map(toViewModel),
        recentItems: recentRows.map(toViewModel),
    };
}
