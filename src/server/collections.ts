import "server-only";

import { Prisma } from "@/generated/prisma-client/client";
import { prisma } from "@/lib/prisma";
import type {
    CollectionOptionViewModel,
    CollectionPageViewModel,
    CollectionViewModel,
    DashboardCollectionsViewModel,
    SidebarCollectionsViewModel,
} from "@/types/view-models";
import { getCurrentUserId } from "./current-user";
import { ITEM_SUMMARY_SELECT } from "./items";
import { getItemTypesById } from "./item-types";
import {
    buildCollectionViewModel,
    buildItemSummaryViewModel,
    buildItemTypeBreakdown,
    resolveDominantTypeId,
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

/**
 * The sidebar renders a name plus the dominant-type colour dot, so it needs the same item joins as
 * a card — but none of the description/timestamp columns those cards also read.
 */
const SIDEBAR_COLLECTION_SELECT = {
    id: true,
    name: true,
    isFavorite: true,
    defaultTypeId: true,
    items: {
        select: { item: { select: { itemTypeId: true, updatedAt: true } } },
    },
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

/**
 * Every collection the user could file an item into, for the pickers on the two item forms.
 *
 * Ordered by name rather than by recency, because this is a list to *find* a collection in — the
 * ordering the sidebar and the cards use answers a different question ("what did I touch last") and
 * would move a checkbox out from under the cursor between one open and the next.
 *
 * Deliberately not `getCollections()`: that reads every collection's items to derive a dominant type
 * and a count, none of which a checkbox renders.
 */
export async function getCollectionOptions(): Promise<CollectionOptionViewModel[]> {
    const userId = await getCurrentUserId();

    return prisma.collection.findMany({
        where: { userId },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
    });
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

    const [favorites, recentNonFavorites, itemTypesById] = await Promise.all([
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
        getItemTypesById(userId),
    ]);

    const toSidebarCollection = (
        row: Prisma.CollectionGetPayload<{ select: typeof SIDEBAR_COLLECTION_SELECT }>,
    ) => {
        const items = row.items.map(({ item }) => item);
        const dominantTypeId = resolveDominantTypeId(row, items);
        return {
            id: row.id,
            name: row.name,
            isFavorite: row.isFavorite,
            itemCount: items.length,
            dominantItemType: dominantTypeId ? (itemTypesById.get(dominantTypeId) ?? null) : null,
        };
    };

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
            // The same select the item lists use, imported rather than restated: this page builds
            // the same summary view model, so a copy of the column list here is a copy that silently
            // falls behind the builder it feeds.
            items: { select: { item: { select: ITEM_SUMMARY_SELECT } } },
        },
    });

    if (!row) {
        return undefined;
    }

    const itemTypesById = await getItemTypesById(userId);
    const items = row.items.map(({ item }) => item);

    return {
        collection: buildCollectionViewModel(row, items, itemTypesById),
        // Counted from the items already in hand rather than by a `groupBy` of its own: this query
        // has read every row in the collection, so a second trip to the database would only ask
        // Postgres to re-derive what is sitting in memory.
        itemTypeCounts: buildItemTypeBreakdown(items, itemTypesById),
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
