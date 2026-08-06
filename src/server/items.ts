import "server-only";

import { getItemTypeNameBySlug } from "@/config/item-type-catalog";
import { Prisma } from "@/generated/prisma-client/client";
import { canAccessItemType } from "@/lib/limits";
import { prisma } from "@/lib/prisma";
import type {
    DashboardItemsViewModel,
    ItemDetailViewModel,
    ItemTypePageViewModel,
} from "@/types/view-models";
import { getCurrentUser, getCurrentUserId } from "./current-user";
import { getItemTypesById } from "./item-types";
import {
    buildItemDetailViewModel,
    buildItemSummaryViewModel,
    toItemTypeViewModel,
} from "./view-models";

/**
 * Only the columns a card reads — never an item body (`content` / `url` / `fileKey`), which keeps
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

/**
 * The summary columns plus the body — the one query in this module that reads `content`, and only
 * ever for a single item the drawer has been opened on.
 */
const ITEM_DETAIL_SELECT = {
    ...ITEM_SUMMARY_SELECT,
    content: true,
    url: true,
    language: true,
    // The object's name and size, but never its key: the drawer addresses a file as `/api/files/[id]`
    // and has no use for one, so the key stays server-side and cannot be handed back to us as if it
    // had been checked.
    fileName: true,
    fileSize: true,
    createdAt: true,
    collections: { select: { collection: { select: { name: true } } } },
} as const;

/** How many recent (non-pinned) items the dashboard lists. */
const RECENT_ITEMS_LIMIT = 10;

/**
 * Defensive upper bound on the item-type page list. The page renders every row as a card, so an
 * unbounded read would pull a Pro user's entire type into one DOM list. Set well above the free
 * tier's 50-item cap, so it is a safety valve rather than a visible limit until real pagination
 * lands.
 */
const ITEM_TYPE_PAGE_LIMIT = 200;

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

/**
 * One item with its body, for the detail drawer. Returns undefined when no such item belongs to the
 * signed-in user, which the route handler answers as a 404.
 *
 * Ownership is part of the `where` rather than a check on the result: a row that is not the caller's
 * is never read at all, and an id belonging to someone else is indistinguishable from one that does
 * not exist — the same answer either way, so the endpoint cannot be used to probe for items.
 */
export async function getItemDetail(id: string): Promise<ItemDetailViewModel | undefined> {
    const userId = await getCurrentUserId();

    const row = await prisma.item.findFirst({
        where: { id, userId },
        select: ITEM_DETAIL_SELECT,
    });
    if (!row) {
        return undefined;
    }

    const itemTypesById = await getItemTypesById(userId);

    return buildItemDetailViewModel(
        {
            ...row,
            tags: row.tags.map((tag) => tag.name),
            collections: row.collections.map((link) => link.collection.name),
        },
        itemTypesById,
    );
}

/**
 * The R2 object behind one item, for `GET /api/files/[id]`.
 *
 * The whole authorization story for a file lives in this `where`: the key is read from a row that
 * belongs to the signed-in user, so a caller can only ever name an *item*, never an object. An item
 * that is someone else's, does not exist, or has no file are all the same `undefined` — the same
 * rule `getItemDetail` follows.
 */
export async function getItemFile(id: string): Promise<{ key: string; name: string } | undefined> {
    const userId = await getCurrentUserId();

    const row = await prisma.item.findFirst({
        where: { id, userId },
        select: { fileKey: true, fileName: true },
    });

    if (!row?.fileKey) {
        return undefined;
    }

    return { key: row.fileKey, name: row.fileName ?? "download" };
}

/**
 * An item-type page (`/items/snippets`, ...): the type and all of the user's items of that type,
 * most recently updated first. The slug resolves to a system type only, so it is looked up with
 * `userId: null` — a user's custom type could share the name (see `project-overview.md` §5).
 * Returns undefined for an unknown slug or a type the user cannot access, so the page can 404.
 */
export async function getItemTypePageData(
    slug: string,
): Promise<ItemTypePageViewModel | undefined> {
    const name = getItemTypeNameBySlug(slug);
    if (!name) {
        return undefined;
    }

    const user = await getCurrentUser();

    const typeRow = await prisma.itemType.findFirst({
        where: { name, userId: null },
        select: { id: true, name: true, icon: true, color: true },
    });
    if (!typeRow) {
        return undefined;
    }

    const itemType = toItemTypeViewModel(typeRow);
    if (!canAccessItemType(user.isPro, itemType.isPro)) {
        return undefined;
    }

    const rows = await prisma.item.findMany({
        where: { userId: user.id, itemTypeId: itemType.id },
        orderBy: { updatedAt: "desc" },
        take: ITEM_TYPE_PAGE_LIMIT,
        select: ITEM_SUMMARY_SELECT,
    });

    const itemTypesById = new Map([[itemType.id, itemType]]);

    return {
        itemType,
        items: rows.map((row) =>
            buildItemSummaryViewModel(
                { ...row, tags: row.tags.map((tag) => tag.name) },
                itemTypesById,
            ),
        ),
    };
}
