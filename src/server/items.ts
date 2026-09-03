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
 * The item read path: every query behind a page, listing or drawer that shows items.
 *
 * One of the two main query modules of the authenticated app (its sibling is `collections.ts`).
 * Server components call these functions directly; `GET /api/items/[id]` and `GET /api/files/[id]`
 * call the two single-item reads. Each one resolves its owner through `getCurrentUserId`, scopes its
 * `where` by that id, and hands rows to the builders in `./view-models`, so nothing outside `server/`
 * sees a Prisma record.
 *
 * @remarks
 * {@link ITEM_SUMMARY_SELECT} is the column list every listing shares, and it never reads an item
 * body. `ITEM_DETAIL_SELECT` is the one exception, used for a single item the drawer has opened.
 * Widening the summary select is how a listing starts reading `content`.
 */

/**
 * Only the columns a card or file row reads — never an item body (`content` / `url` / `fileKey`),
 * which keeps list queries off the large content columns. `tags` is joined as names, flattened by
 * {@link toItemSummaries}.
 *
 * @remarks
 * `fileName`, `fileSize` and `createdAt` are here rather than only on the detail select because the
 * file listing describes each object by its name, size and upload date without opening anything.
 * They are three narrow scalars on a row already being read — and still never the object's key,
 * which no client has a use for: a file is addressed as `/api/files/[id]`, so the key stays
 * server-side and cannot be handed back as if it had been checked.
 */
export const ITEM_SUMMARY_SELECT = {
    id: true,
    title: true,
    description: true,
    itemTypeId: true,
    isFavorite: true,
    isPinned: true,
    // The date every listing sorts by and every card renders: `editedAt` moves only when the item's
    // content changes. `Item`'s other timestamp, `updatedAt`, is Prisma's automatic one and moves on
    // any write to the row — a favourite or pin toggle included — so it is not a recency answer and
    // nothing user-facing reads it.
    editedAt: true,
    createdAt: true,
    fileName: true,
    fileSize: true,
    tags: { select: { name: true } },
} as const;

type ItemSummaryRow = Prisma.ItemGetPayload<{ select: typeof ITEM_SUMMARY_SELECT }>;

/**
 * Adapts {@link ITEM_SUMMARY_SELECT}'s rows into summary view models — the join between the Prisma
 * payload and the structural row types `./view-models` declares.
 *
 * It lives here rather than there because its input is a Prisma payload, and that module keeps its
 * inputs decoupled from the persistence shape; this is the seam, so it belongs beside the `select`
 * that produces the rows.
 *
 * @remarks
 * The tag flattening is what it exists for. The select joins tags as `{ name }[]` while the builder
 * expects `readonly string[]`, and a caller that omits the `.map` fails nowhere obvious — it renders
 * as `[object Object]` in a badge.
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
 * The summary columns plus the body — the one select in this module that reads `content`, and only
 * ever for a single item the drawer has been opened on.
 */
const ITEM_DETAIL_SELECT = {
    ...ITEM_SUMMARY_SELECT,
    content: true,
    url: true,
    language: true,
    // The id as well as the name: the drawer shows the name, but the edit form has to check the
    // boxes for the collections this item is already in, and membership is by id.
    collections: { select: { collection: { select: { id: true, name: true } } } },
} as const;

/**
 * The dashboard's pinned and recent item lists, and the two item stat cards.
 *
 * @remarks
 * The two lists overlap, and each answers its own question independently — *what is pinned* and
 * *what did I work on lately*. A pinned item edited five minutes ago is a true answer to both and
 * appears in both; a Recent section that silently omitted it could not be read at all, and would
 * make `isPinned` mean "show first" on every other listing and "remove from Recent" here.
 *
 * They sort on different columns for the same reason. Recent is recency, so `editedAt`; Pinned is a
 * list *of pins*, so `pinnedAt`, newest pin first — ordering it by `editedAt` would drop a pinned old
 * snippet at the bottom of the section, making the click look like it did nothing.
 *
 * Pinned is the one list here with no `take`. Recent grows on its own as the user works and has to
 * be bounded; Pinned grows only when the user asks it to, one click at a time, and a cap would hide
 * something explicitly requested.
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
            // No `isPinned` filter: recency is the only question this list asks.
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
 * clicking one opens `ItemDrawer`, which takes a summary view model, so a reduced shape would have
 * to be re-fetched before the drawer could open on it. Still no item bodies.
 *
 * @remarks
 * Unpaginated. This is the one list whose length the user sets directly, a star at a time, so a page
 * control would sit in front of a list most accounts never fill one page of. `buildPagination` and
 * the `/items/[slug]` pattern are what it grows into if that stops being true.
 *
 * Ordered by `editedAt` like every other item listing, so starring something does not lift it to the
 * top of this page — the rows render `editedAt`, and a list sorted by a date it does not show reads
 * as shuffled. Genuine "most recently starred" needs a `favoritedAt` column; the page's own sort
 * control covers name and type meanwhile.
 */
export async function getFavoriteItems(): Promise<ItemSummaryViewModel[]> {
    const userId = await getCurrentUserId();

    const [rows, itemTypesById] = await Promise.all([
        prisma.item.findMany({
            where: { userId, isFavorite: true },
            // Tie-broken by id like every other ordered list here. Nothing is paginated, so no row
            // can land on two pages — but two items saved in one write share an `editedAt`, and an
            // order Postgres is free to vary between renders appears to shuffle itself.
            orderBy: [{ editedAt: "desc" }, { id: "desc" }],
            select: ITEM_SUMMARY_SELECT,
        }),
        getItemTypesById(userId),
    ]);

    return toItemSummaries(rows, itemTypesById);
}

/**
 * One item with its body, for the detail drawer behind `GET /api/items/[id]`.
 *
 * @returns `undefined` when no such item belongs to the signed-in user, which the route answers as a
 * 404.
 *
 * @remarks
 * Ownership is part of the `where` rather than a check on the result: a row that is not the caller's
 * is never read, and an id belonging to someone else is indistinguishable from one that does not
 * exist, so the endpoint cannot be used to probe for items.
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
 * @returns `undefined` when the item is someone else's, does not exist, or has no file — one answer
 * for all three, the rule {@link getItemDetail} follows.
 *
 * @remarks
 * The whole authorization story for a file is this `where`: the key is read from a row that belongs
 * to the signed-in user, so a caller can only ever name an *item*, never an object.
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
 * An item-type page (`/items/snippets`, …): the type, and one page of the user's items of it.
 *
 * @returns `undefined` only for a slug that names no system type, which is the one genuine 404. A
 * Pro-gated type opened without Pro comes back `locked`, for the page to render as an upgrade
 * prompt.
 *
 * @remarks
 * The slug resolves to a system type only, so the lookup goes through `findSystemItemType`: a user's
 * custom type could share the name.
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

    // Locked rather than absent: the page is where the product explains what Pro buys, and a 404
    // would claim `/items/files` does not exist. The reads below are skipped — nothing is rendered
    // from them for an account that cannot open the type.
    if (!canAccessItemType(user.isPro, itemType.isPro)) {
        return { locked: true, itemType };
    }

    const where = { userId: user.id, itemTypeId: itemType.id };

    // Counted before the rows are read: the requested page has to be clamped against the total
    // before it can become a `skip`, or a page past the end is answered with an empty list under
    // controls claiming there was something there.
    const pagination = buildPagination(
        await prisma.item.count({ where }),
        requestedPage,
        ITEMS_PER_PAGE,
    );

    const rows = await prisma.item.findMany({
        where,
        // Pinned first, then recency. This belongs in the query rather than in a re-sort of the rows
        // that come back: the listing is paginated, and sorting one page in memory would lift a
        // pinned item to the top of page three while leaving it on page three.
        //
        // `id` breaks ties because `skip`/`take` only mean anything over a total order: two items
        // saved in one write share an `editedAt`, and without a tiebreaker Postgres may return them
        // in either order, which is how one row appears on two pages.
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
