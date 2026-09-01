import "server-only";

import { DASHBOARD_COLLECTIONS_LIMIT, SIDEBAR_RECENT_COLLECTIONS_LIMIT } from "@/config/dashboard";
import { COLLECTIONS_PER_PAGE, ITEMS_PER_PAGE } from "@/config/pagination";
import { Prisma } from "@/generated/prisma-client/client";
import { buildPagination, paginationSkip } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import type {
    CollectionOptionViewModel,
    CollectionPageViewModel,
    CollectionsPageViewModel,
    CollectionViewModel,
    DashboardCollectionsViewModel,
    FavoriteCollectionViewModel,
    SidebarCollectionsViewModel,
} from "@/types/view-models";
import { getCurrentUserId } from "./current-user";
import { ITEM_SUMMARY_SELECT, toItemSummaries } from "./items";
import { getItemTypesById } from "./item-types";
import {
    buildCollectionSummary,
    buildCollectionViewModel,
    buildItemTypeBreakdown,
} from "./view-models";

/**
 * The two columns the dominant-type rule reads, and nothing else — never an item body.
 *
 * Stated once because both selects below need exactly it, and the risk in a join written twice is
 * not the duplication: it is that one copy grows a column. Widening this by hand is how a card query
 * starts reading item bodies.
 */
const COLLECTION_ITEMS_JOIN = {
    select: { item: { select: { itemTypeId: true, editedAt: true } } },
} as const;

/**
 * Everything `CollectionViewModel` derives from.
 */
const COLLECTION_SELECT = {
    id: true,
    name: true,
    description: true,
    isFavorite: true,
    defaultTypeId: true,
    updatedAt: true,
    items: COLLECTION_ITEMS_JOIN,
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
    items: COLLECTION_ITEMS_JOIN,
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

/** One page of the user's collections, most recently updated first. */
export async function getCollections(requestedPage: number): Promise<CollectionsPageViewModel> {
    const userId = await getCurrentUserId();

    // Counted first so the requested page can be clamped before it becomes a `skip` — the same
    // ordering `getItemTypePageData` follows, and for the same reason.
    const pagination = buildPagination(
        await prisma.collection.count({ where: { userId } }),
        requestedPage,
        COLLECTIONS_PER_PAGE,
    );

    const rows = await prisma.collection.findMany({
        where: { userId },
        // Tie-broken by id, so the page boundary is stable — see the note in `getItemTypePageData`.
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        skip: paginationSkip(pagination),
        take: pagination.perPage,
        select: COLLECTION_SELECT,
    });

    return { collections: await toCollectionViewModels(rows, userId), pagination };
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
            take: DASHBOARD_COLLECTIONS_LIMIT,
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
            take: SIDEBAR_RECENT_COLLECTIONS_LIMIT,
            select: SIDEBAR_COLLECTION_SELECT,
        }),
        getItemTypesById(userId),
    ]);

    const toSidebarCollection = (
        row: Prisma.CollectionGetPayload<{ select: typeof SIDEBAR_COLLECTION_SELECT }>,
    ) => ({
        ...buildCollectionSummary(
            row,
            row.items.map(({ item }) => item),
            itemTypesById,
        ),
        isFavorite: row.isFavorite,
    });

    return {
        favoriteCollections: favorites.map(toSidebarCollection),
        recentNonFavoriteCollections: recentNonFavorites.map(toSidebarCollection),
    };
}

/**
 * Every collection the user has favourited, most recently touched first, for `/favorites`.
 *
 * The same item join the sidebar uses, plus the timestamp the row renders — the dominant type is what
 * colours the folder icon, so a favourites row is recognisable as the same collection the sidebar and
 * the cards show. Unpaginated for the reason `getFavoriteItems` is.
 */
export async function getFavoriteCollections(): Promise<FavoriteCollectionViewModel[]> {
    const userId = await getCurrentUserId();

    const [rows, itemTypesById] = await Promise.all([
        prisma.collection.findMany({
            where: { userId, isFavorite: true },
            orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
            select: { ...SIDEBAR_COLLECTION_SELECT, updatedAt: true },
        }),
        getItemTypesById(userId),
    ]);

    return rows.map((row) => ({
        ...buildCollectionSummary(
            row,
            row.items.map(({ item }) => item),
            itemTypesById,
        ),
        updatedAt: row.updatedAt.toISOString(),
    }));
}

/**
 * A single collection and one page of the items in it. Scoped by owner as well as id: an id alone
 * would let one user read another's collection.
 *
 * Two reads rather than one nested read, because the page asks two different questions of the same
 * collection. The header describes the *whole* collection — its item count, its dominant type, and
 * how those items divide by type — while the grid below shows one page of them. So the collection
 * row keeps the plain `COLLECTION_SELECT` join, which carries two scalars per item and no bodies,
 * and the items are read separately with a `skip`/`take` over the summary columns. The join it used
 * to have instead — `ITEM_SUMMARY_SELECT` on every row — was the same query doing both jobs, and it
 * is the one that could not be paginated: narrowing it to a page would have quietly turned the
 * header's counts into counts of the visible page.
 */
export async function getCollectionPageData(
    collectionId: string,
    requestedPage: number,
): Promise<CollectionPageViewModel | undefined> {
    const userId = await getCurrentUserId();

    const row = await prisma.collection.findFirst({
        where: { id: collectionId, userId },
        select: COLLECTION_SELECT,
    });

    if (!row) {
        return undefined;
    }

    const collectionItems = row.items.map(({ item }) => item);

    // No `count` query: the join above already has one row per item, so the total is its length.
    const pagination = buildPagination(collectionItems.length, requestedPage, ITEMS_PER_PAGE);

    const [itemRows, itemTypesById] = await Promise.all([
        prisma.item.findMany({
            // `userId` as well as the membership filter, so this cannot widen what the collection
            // read already authorized.
            where: { userId, collections: { some: { collectionId } } },
            // Pinned first, then recency, then `id` — the same total order the item-type listing
            // uses, and paginated for the same reason it is sorted in the query rather than after.
            orderBy: [{ isPinned: "desc" }, { editedAt: "desc" }, { id: "desc" }],
            skip: paginationSkip(pagination),
            take: pagination.perPage,
            select: ITEM_SUMMARY_SELECT,
        }),
        getItemTypesById(userId),
    ]);

    return {
        collection: buildCollectionViewModel(row, collectionItems, itemTypesById),
        pagination,
        // Still counted from the rows in hand rather than by a `groupBy`: the breakdown is over the
        // whole collection, which is exactly what the join above holds.
        itemTypeCounts: buildItemTypeBreakdown(collectionItems, itemTypesById),
        // Ordered by the query now, not in memory — a page of rows sorted after the fact would only
        // be sorted within itself.
        items: toItemSummaries(itemRows, itemTypesById),
    };
}
