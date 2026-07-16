import "server-only";

import { Prisma } from "@/generated/prisma-client/client";
import { prisma } from "@/lib/prisma";
import type {
    CollectionPageViewModel,
    CollectionViewModel,
    DashboardCollectionsViewModel,
    SidebarCollectionsViewModel,
} from "@/types/view-models";
import { getCurrentUserId } from "./current-user";
import { getItemTypesById } from "./item-types";
import {
    buildCollectionViewModel,
    buildItemSummaryViewModel,
    sortByUpdatedAtDesc,
} from "./view-models";

/**
 * Everything `CollectionViewModel` derives from. The item join carries only the two columns the
 * dominant-type rule reads — pulling whole items here would drag every item body into a card query.
 */
const COLLECTION_SELECT = {
    id: true,
    name: true,
    description: true,
    isFavorite: true,
    defaultTypeId: true,
    updatedAt: true,
    items: {
        select: { item: { select: { itemTypeId: true, updatedAt: true } } },
    },
} as const;

/** The sidebar renders a name and a count, so it does not need the type joins above. */
const SIDEBAR_COLLECTION_SELECT = {
    id: true,
    name: true,
    isFavorite: true,
    _count: { select: { items: true } },
} as const;

type CollectionRowWithItems = Prisma.CollectionGetPayload<{ select: typeof COLLECTION_SELECT }>;

async function toCollectionViewModels(
    rows: CollectionRowWithItems[],
    userId: string,
): Promise<CollectionViewModel[]> {
    const itemTypesById = await getItemTypesById(userId);

    return rows.map((row) =>
        buildCollectionViewModel(
            row,
            row.items.map(({ item }) => item),
            itemTypesById,
        ),
    );
}

/** All of the user's collections, most recently updated first. */
export async function getCollections(): Promise<CollectionViewModel[]> {
    const userId = await getCurrentUserId();

    const rows = await prisma.collection.findMany({
        where: { userId },
        orderBy: { updatedAt: "desc" },
        select: COLLECTION_SELECT,
    });

    return toCollectionViewModels(rows, userId);
}

/** The dashboard's recent-collection cards, plus the two collection stat cards. */
export async function getDashboardCollections(): Promise<DashboardCollectionsViewModel> {
    const userId = await getCurrentUserId();

    const [rows, totalCollections, favoriteCollections] = await Promise.all([
        prisma.collection.findMany({
            where: { userId },
            orderBy: { updatedAt: "desc" },
            take: 6,
            select: COLLECTION_SELECT,
        }),
        prisma.collection.count({ where: { userId } }),
        prisma.collection.count({ where: { userId, isFavorite: true } }),
    ]);

    return {
        totalCollections,
        favoriteCollections,
        recentCollections: await toCollectionViewModels(rows, userId),
    };
}

/** Favorites (all of them) and the five most recent non-favorites. */
export async function getSidebarCollections(): Promise<SidebarCollectionsViewModel> {
    const userId = await getCurrentUserId();

    const [favorites, recentNonFavorites] = await Promise.all([
        prisma.collection.findMany({
            where: { userId, isFavorite: true },
            orderBy: { updatedAt: "desc" },
            select: SIDEBAR_COLLECTION_SELECT,
        }),
        prisma.collection.findMany({
            where: { userId, isFavorite: false },
            orderBy: { updatedAt: "desc" },
            take: 5,
            select: SIDEBAR_COLLECTION_SELECT,
        }),
    ]);

    const toSidebarCollection = (
        row: Prisma.CollectionGetPayload<{ select: typeof SIDEBAR_COLLECTION_SELECT }>,
    ) => ({
        id: row.id,
        name: row.name,
        isFavorite: row.isFavorite,
        itemCount: row._count.items,
    });

    return {
        favoriteCollections: favorites.map(toSidebarCollection),
        recentNonFavoriteCollections: recentNonFavorites.map(toSidebarCollection),
    };
}

/**
 * A single collection and the items in it. Scoped by owner as well as id: an id alone would let
 * one user read another's collection.
 */
export async function getCollectionPageData(
    collectionId: string,
): Promise<CollectionPageViewModel | undefined> {
    const userId = await getCurrentUserId();

    const row = await prisma.collection.findFirst({
        where: { id: collectionId, userId },
        select: {
            ...COLLECTION_SELECT,
            items: {
                select: {
                    item: {
                        select: {
                            id: true,
                            title: true,
                            description: true,
                            itemTypeId: true,
                            isFavorite: true,
                            isPinned: true,
                            updatedAt: true,
                            tags: { select: { name: true } },
                        },
                    },
                },
            },
        },
    });

    if (!row) {
        return undefined;
    }

    const itemTypesById = await getItemTypesById(userId);
    const items = row.items.map(({ item }) => item);

    return {
        collection: buildCollectionViewModel(row, items, itemTypesById),
        items: sortByUpdatedAtDesc(
            items.map((item) =>
                buildItemSummaryViewModel(
                    { ...item, tags: item.tags.map((tag) => tag.name) },
                    itemTypesById,
                ),
            ),
        ),
    };
}
