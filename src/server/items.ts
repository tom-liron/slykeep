import "server-only";

import { DASHBOARD_RECENT_ITEMS_LIMIT } from "@/config/dashboard";
import { getItemTypeNameBySlug } from "@/config/item-type-catalog";
import { ITEMS_PER_PAGE } from "@/config/pagination";
import { Prisma } from "@/generated/prisma-client/client";
import { canAccessItemType } from "@/lib/limits";
import { buildPagination, paginationSkip } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import type {
    DashboardItemsViewModel,
    ItemDetailViewModel,
    ItemSummaryViewModel,
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
 * Only the columns a card or file row reads — never an item body (`content` / `url` / `fileKey`),
 * which keeps list queries off the large content columns. `tags` is joined as names, flattened below.
 *
 * `fileName`, `fileSize`, and `createdAt` are read here rather than only for the drawer because the
 * file list describes each object by its name, size, and upload date without opening anything. They
 * are three narrow scalars on a row already being read — and still never the object's key, which no
 * client has a use for: a file is addressed as `/api/files/[id]`, so the key stays server-side and
 * cannot be handed back to us as if it had been checked.
 */
export const ITEM_SUMMARY_SELECT = {
    id: true,
    title: true,
    description: true,
    itemTypeId: true,
    isFavorite: true,
    isPinned: true,
    updatedAt: true,
    createdAt: true,
    fileName: true,
    fileSize: true,
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
    // The id as well as the name: the drawer only ever showed the name, but the edit form has to
    // check the boxes for the collections this item is already in, and membership is by id.
    collections: { select: { collection: { select: { id: true, name: true } } } },
} as const;

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
            take: DASHBOARD_RECENT_ITEMS_LIMIT,
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
 * Every item the user has favourited, most recently touched first, for `/favorites`.
 *
 * Full summaries rather than a narrower row, for the reason the search prefetch carries them too:
 * clicking one opens `ItemDrawer`, which takes an `ItemSummaryViewModel` — a reduced shape would have
 * to be re-fetched before the drawer could open on it. Still no item bodies, so this stays a list
 * query.
 *
 * Unpaginated, deliberately. This is the one list in the app whose length the user chooses directly,
 * a star at a time, and paginating it would put a page control in front of a list most accounts will
 * never fill one page of. Should that stop being true, `buildPagination` and the `/items/[slug]`
 * pattern are what it grows into.
 *
 * "Most recently touched" is as close to "most recently favourited" as the schema can get: there is
 * no favourited-at column, and `updatedAt` is what the toggle moves (`project-overview.md` §11).
 */
export async function getFavoriteItems(): Promise<ItemSummaryViewModel[]> {
    const userId = await getCurrentUserId();

    const [rows, itemTypesById] = await Promise.all([
        prisma.item.findMany({
            where: { userId, isFavorite: true },
            // Tie-broken by id like every other ordered list here. Nothing is paginated, so no row
            // can land on two pages — but two items saved in one write still have the same
            // `updatedAt`, and an order Postgres is free to vary between renders is one that appears
            // to shuffle itself.
            orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
            select: ITEM_SUMMARY_SELECT,
        }),
        getItemTypesById(userId),
    ]);

    return rows.map((row) =>
        buildItemSummaryViewModel({ ...row, tags: row.tags.map((tag) => tag.name) }, itemTypesById),
    );
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
            collections: row.collections.map((link) => link.collection),
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
 * An item-type page (`/items/snippets`, ...): the type and one page of the user's items of that
 * type, most recently updated first. The slug resolves to a system type only, so it is looked up
 * with `userId: null` — a user's custom type could share the name (see `project-overview.md` §5).
 * Returns undefined for an unknown slug or a type the user cannot access, so the page can 404.
 */
export async function getItemTypePageData(
    slug: string,
    requestedPage: number,
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

    const where = { userId: user.id, itemTypeId: itemType.id };

    // Counted before the rows are read rather than alongside them: the requested page has to be
    // clamped against the total before it can become a `skip`, and a page past the end would
    // otherwise be answered with an empty list under controls claiming there was something there.
    const pagination = buildPagination(
        await prisma.item.count({ where }),
        requestedPage,
        ITEMS_PER_PAGE,
    );

    const rows = await prisma.item.findMany({
        where,
        // Pinned first, then recency. This belongs in the query rather than in a re-sort of the
        // rows that come back: the listing is paginated, and sorting one page in memory would lift a
        // pinned item to the top of page three while leaving it on page three.
        //
        // `id` breaks ties on purpose: `skip`/`take` only mean anything over a total order, and two
        // items saved in the same write carry the same `updatedAt` — without a tiebreaker Postgres
        // is free to return them in either order, which is how a row appears on two pages at once.
        orderBy: [{ isPinned: "desc" }, { updatedAt: "desc" }, { id: "desc" }],
        skip: paginationSkip(pagination),
        take: pagination.perPage,
        select: ITEM_SUMMARY_SELECT,
    });

    const itemTypesById = new Map([[itemType.id, itemType]]);

    return {
        itemType,
        pagination,
        items: rows.map((row) =>
            buildItemSummaryViewModel(
                { ...row, tags: row.tags.map((tag) => tag.name) },
                itemTypesById,
            ),
        ),
    };
}
