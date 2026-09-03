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
 * The collection read path: every query behind a page, card, sidebar entry or picker that shows
 * collections.
 *
 * The sibling of `items.ts`, and the reason the two are separate modules is the join below: a
 * collection is never shown without its derived metadata — an item count, and the dominant type that
 * colours it — so every query here reads two scalars per contained item and hands them to the
 * builders in `./view-models`. Server components call these functions directly;
 * `GET /api/collections` calls {@link getCollectionOptions} for the item forms' picker.
 *
 * Each query resolves its owner through `getCurrentUserId` and scopes its `where` by that id.
 */

/**
 * The two columns the dominant-type rule reads, and nothing else — never an item body.
 *
 * @remarks
 * Stated once because both selects below need exactly it. The risk in a join written twice is not
 * the duplication but that one copy grows a column, which is how a card query starts reading item
 * bodies.
 */
const COLLECTION_ITEMS_JOIN = {
    select: { item: { select: { itemTypeId: true, editedAt: true } } },
} as const;

/** Everything a `CollectionViewModel` derives from, for the cards and the collection page. */
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
 * The sidebar renders a name plus the dominant-type colour dot, so it needs the same item join as a
 * card — but none of the description or timestamp columns those cards also read.
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

/** One page of the user's collections, most recently updated first, for `/collections`. */
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
 * @remarks
 * Ordered by name rather than by recency: this is a list to *find* a collection in, and the ordering
 * the sidebar and cards use answers a different question — it would move a checkbox out from under
 * the cursor between one open and the next.
 *
 * It reads two columns rather than reusing {@link getCollections}, which derives a dominant type and
 * a count from every collection's items — none of which a checkbox renders.
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

/**
 * The sidebar's two collection lists: every favourite, and the most recent non-favourites.
 *
 * @remarks
 * This runs on every dashboard page view, which is why it reads
 * {@link SIDEBAR_COLLECTION_SELECT} rather than the wider card select.
 */
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
 * The sidebar's item join plus the timestamp the row renders. The dominant type colours the folder
 * icon, so a favourites row is recognisable as the same collection the sidebar and the cards show.
 * Unpaginated for the reason `getFavoriteItems` is.
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
 * A single collection and one page of the items in it.
 *
 * @returns `undefined` when no such collection belongs to the signed-in user. Scoped by owner as
 * well as id: an id alone would let one user read another's collection.
 *
 * @remarks
 * Two reads rather than one nested read, because the page asks two questions of the same collection.
 * The header describes the *whole* collection — its item count, its dominant type, and how those
 * items divide by type — while the grid below shows one page of them. So the collection row keeps
 * the plain {@link COLLECTION_SELECT} join, which carries two scalars per item and no bodies, and
 * the items are read separately with a `skip`/`take` over the summary columns. A single query doing
 * both jobs cannot be paginated without turning the header's counts into counts of the visible page.
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
            // uses, and sorted in the query for the same reason it is there.
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
        // Counted from the rows already in hand rather than by a `groupBy`: the breakdown is over the
        // whole collection, which is exactly what the join above holds.
        itemTypeCounts: buildItemTypeBreakdown(collectionItems, itemTypesById),
        items: toItemSummaries(itemRows, itemTypesById),
    };
}
