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
import { findSystemItemType, getItemTypesById } from "./item-types";
import {
    buildItemDetailViewModel,
    buildItemSummaryViewModel,
    toItemTypeViewModel,
    type ItemTypeMap,
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
    // `editedAt`, not `updatedAt`: this is the date every listing sorts by and every card renders,
    // and it is the one that means the item's content changed. `updatedAt` also moves on a
    // favourite or pin toggle, so nothing user-facing reads it — see `prisma/schema.prisma`.
    editedAt: true,
    createdAt: true,
    fileName: true,
    fileSize: true,
    tags: { select: { name: true } },
} as const;

type ItemSummaryRow = Prisma.ItemGetPayload<{ select: typeof ITEM_SUMMARY_SELECT }>;

/**
 * `ITEM_SUMMARY_SELECT`'s rows as view models — the adapter between the two shapes.
 *
 * Here rather than in `view-models.ts` because the input is a Prisma payload, and that module states
 * as a rule that its inputs are declared structurally so its derivation rules stay decoupled from
 * the persistence shape. This is the join between the two, so it belongs on the persistence side,
 * beside the `select` that produces the row.
 *
 * The tag flattening is the whole reason it exists. The select joins tags as `{ name }[]` while
 * `ItemSummaryRow` in `view-models.ts` declares `readonly string[]`, so every list query has to
 * bridge those two by hand — and it was written out at five call sites across three modules. A copy
 * that forgets the `.map` does not fail anywhere obvious: it fails inside
 * `buildItemSummaryViewModel`'s `[...item.tags]`, and renders as `[object Object]` in a badge.
 */
export function toItemSummaries(
    rows: readonly ItemSummaryRow[],
    itemTypesById: ItemTypeMap,
): ItemSummaryViewModel[] {
    return rows.map((row) =>
        buildItemSummaryViewModel({ ...row, tags: row.tags.map((tag) => tag.name) }, itemTypesById),
    );
}

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
 *
 * The two lists overlap, deliberately. Recent used to filter `isPinned: false`, which made them
 * disjoint — no card twice on one screen, and Recent's ten slots never spent on something already
 * shown above it. Both are real benefits and both lose to the resulting lie: a section labelled
 * Recent that silently omits an item edited five minutes ago cannot be read at all, and nothing on
 * the page explains the omission. It also made `isPinned` mean two different things in one app —
 * every listing outside this one keeps pinned items and merely sorts them first, so pinning meant
 * "show first" there and "remove from Recent" here.
 *
 * So each list now answers its own question independently — *what is pinned* and *what did I work on
 * lately* — and a pinned item that was just edited is a true answer to both, appearing in both. That
 * redundancy is the accepted cost; it is the same trade a starred email makes by staying in the
 * inbox.
 *
 * They sort on different columns for the same reason. Recent is recency, so `editedAt`. Pinned is a
 * list *of pins*, so `pinnedAt` — newest pin first. Ordering it by `editedAt` was the first attempt
 * and it made pinning look broken: pin an old reference snippet and it lands at the bottom of the
 * section, so the click appears to do nothing at all.
 *
 * Pinned is also the one list here with no `take`. Recent grows on its own as you work and has to be
 * bounded; Pinned only grows when the user asks it to, one click at a time, which is the same
 * argument that keeps `/favorites` unpaginated. A cap here hides something explicitly requested.
 */
export async function getDashboardItems(): Promise<DashboardItemsViewModel> {
    const userId = await getCurrentUserId();

    const [pinnedRows, recentRows, totalItems, favoriteItems, itemTypesById] = await Promise.all([
        prisma.item.findMany({
            where: { userId, isPinned: true },
            // `pinnedAt` is non-null for every row this `where` matches, so the ordering is total
            // without a nulls rule — the two columns are written together by `toggleItemPin`.
            orderBy: [{ pinnedAt: "desc" }, { id: "desc" }],
            select: ITEM_SUMMARY_SELECT,
        }),
        prisma.item.findMany({
            // No `isPinned` filter: see above. Recency is the only question this list asks.
            where: { userId },
            orderBy: { editedAt: "desc" },
            take: DASHBOARD_RECENT_ITEMS_LIMIT,
            select: ITEM_SUMMARY_SELECT,
        }),
        prisma.item.count({ where: { userId } }),
        prisma.item.count({ where: { userId, isFavorite: true } }),
        getItemTypesById(userId),
    ]);

    return {
        totalItems,
        favoriteItems,
        pinnedItems: toItemSummaries(pinnedRows, itemTypesById),
        recentItems: toItemSummaries(recentRows, itemTypesById),
    };
}

/**
 * Every item the user has favourited, most recently edited first, for `/favorites`.
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
 * Ordered by `editedAt` like every other item listing, which means starring something does *not*
 * lift it to the top of this page. That was the previous behaviour and it was a side effect rather
 * than a feature: ordering by `updatedAt` approximated "most recently favourited" only because the
 * toggle happened to move that column. The rows render `editedAt`, so keeping the old ordering would
 * have sorted this list by a date it does not show. Genuine "most recently starred" needs a
 * `favoritedAt` column, which is deliberately not part of this (`project-overview.md` §11); the sort
 * control on the page covers name and type in the meantime.
 */
export async function getFavoriteItems(): Promise<ItemSummaryViewModel[]> {
    const userId = await getCurrentUserId();

    const [rows, itemTypesById] = await Promise.all([
        prisma.item.findMany({
            where: { userId, isFavorite: true },
            // Tie-broken by id like every other ordered list here. Nothing is paginated, so no row
            // can land on two pages — but two items saved in one write still have the same
            // `editedAt`, and an order Postgres is free to vary between renders is one that appears
            // to shuffle itself.
            orderBy: [{ editedAt: "desc" }, { id: "desc" }],
            select: ITEM_SUMMARY_SELECT,
        }),
        getItemTypesById(userId),
    ]);

    return toItemSummaries(rows, itemTypesById);
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
 *
 * Returns undefined only for a slug that names no system type, which is the one case that is
 * genuinely a 404. A Pro-gated type comes back `locked` instead, for the page to render as an
 * upgrade prompt.
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

    const typeRow = await findSystemItemType(name);
    if (!typeRow) {
        return undefined;
    }

    const itemType = toItemTypeViewModel(typeRow);

    // Locked rather than absent. A 404 here told a free user that `/items/files` does not exist,
    // which is both untrue and the opposite of useful — the page is the best chance the product has
    // to explain what Pro buys. The reads below are skipped: nothing is rendered from them, and an
    // account that cannot open the type has no business paying for the queries.
    if (!canAccessItemType(user.isPro, itemType.isPro)) {
        return { locked: true, itemType };
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
        orderBy: [{ isPinned: "desc" }, { editedAt: "desc" }, { id: "desc" }],
        skip: paginationSkip(pagination),
        take: pagination.perPage,
        select: ITEM_SUMMARY_SELECT,
    });

    const itemTypesById = new Map([[itemType.id, itemType]]);

    return {
        locked: false,
        itemType,
        pagination,
        items: toItemSummaries(rows, itemTypesById),
    };
}
