import "server-only";

import { cache } from "react";

import { SYSTEM_ITEM_TYPE_NAMES } from "@/config/item-type-catalog";
import { prisma } from "@/server/infra/prisma";
import type {
    ItemTypeCountViewModel,
    ItemTypeViewModel,
    SidebarNavViewModel,
    UserViewModel,
} from "@/types/view-models";
import { getCurrentUser } from "./current-user";
import { toItemTypeViewModel } from "./view-models";

/**
 * Item-type reads: resolving the types an account can see, and counting what it has of each.
 *
 * The database half of the item-type system. `ItemType` rows carry only identity and colour, so
 * everything here goes through `toItemTypeViewModel` in `./view-models` to join a row with its
 * catalog presentation before anything renders it. Three surfaces depend on this module: the sidebar
 * nav ({@link getSidebarNav}), the profile page's breakdown, and every list query in `items.ts` and
 * `collections.ts`, which resolve an item's `itemTypeId` through {@link getItemTypesById}.
 *
 * @remarks
 * System types have `userId: null` and custom types belong to a user, which is what makes `name`
 * unique only among system rows — the rule {@link findSystemItemType} exists to keep.
 */

/**
 * The four columns an `ItemTypeViewModel` is built from, and the only ones any caller reads.
 *
 * @remarks
 * The list is not self-evident — the plural label, the route slug, the content type and the Pro flag
 * are configuration rather than columns — so it is stated once instead of at each query.
 */
export const ITEM_TYPE_SELECT = { id: true, name: true, icon: true, color: true } as const;

/**
 * The **system** item type with this name, or null.
 *
 * @remarks
 * Never query by `name` alone: system names are unique only for `userId: null`, and custom rows may
 * share them. This function keeps the required `findFirst` scope in one place.
 */
export function findSystemItemType(name: string) {
    return prisma.itemType.findFirst({
        where: { name, userId: null },
        select: ITEM_TYPE_SELECT,
    });
}

/**
 * Every item type this user can see — the system types plus any custom types they own — keyed by id.
 *
 * A map because callers resolve types by the foreign key on an item or collection. Request-cached,
 * so the several list queries a page runs share one read.
 */
export const getItemTypesById = cache(
    async (userId: string): Promise<ReadonlyMap<string, ItemTypeViewModel>> => {
        const rows = await prisma.itemType.findMany({
            where: { OR: [{ userId: null }, { userId }] },
            select: ITEM_TYPE_SELECT,
        });

        return new Map(
            rows.map((row) => {
                const itemType = toItemTypeViewModel(row);
                return [itemType.id, itemType];
            }),
        );
    },
);

/**
 * Every system item type, in catalog order, each with this user's live item count. Shared by the
 * sidebar nav and the profile page's breakdown; custom types are excluded, since neither lists them.
 *
 * @remarks
 * The list is the same for every account, whatever their plan. A Pro-gated type stays in it carrying
 * `isPro`, so the caller can mark it and the page behind it can explain what Pro buys; what a locked
 * type does when opened belongs to that page rather than to this query. Listing them discloses
 * nothing — the labels are on the public pricing page, and the count beside a locked type is this
 * user's own.
 *
 * One `groupBy` rather than a count per type. `groupBy` returns no row for an empty group, so the
 * `?? 0` below is what keeps a type the user has no items of in the list with a visible zero.
 */
export async function getItemTypeCounts(user: UserViewModel): Promise<ItemTypeCountViewModel[]> {
    const [typeRows, counts] = await Promise.all([
        prisma.itemType.findMany({
            // System rows only. Reading the user's custom types too and then keying them by `name`
            // below would let a custom type sharing a system name overwrite it in the map — the same
            // hazard as a `findUnique` on `name` alone, since `name` is unique only among system
            // rows.
            where: { userId: null },
            select: ITEM_TYPE_SELECT,
        }),
        prisma.item.groupBy({
            by: ["itemTypeId"],
            where: { userId: user.id },
            _count: { _all: true },
        }),
    ]);

    const countByTypeId = new Map(counts.map((row) => [row.itemTypeId, row._count._all]));
    const rowByName = new Map(typeRows.map((row) => [row.name, row]));

    // Catalog order rather than query order, and every system type including the ones this account
    // cannot open.
    return SYSTEM_ITEM_TYPE_NAMES.flatMap((name) => {
        const row = rowByName.get(name);
        return row ? [toItemTypeViewModel(row)] : [];
    }).map((itemType) => ({
        id: itemType.id,
        label: itemType.label,
        icon: itemType.icon,
        color: itemType.color,
        slug: itemType.slug,
        itemCount: countByTypeId.get(itemType.id) ?? 0,
        isPro: itemType.isPro,
    }));
}

/** The sidebar nav: the system item types with their counts, plus the signed-in user. */
export async function getSidebarNav(): Promise<SidebarNavViewModel> {
    const user = await getCurrentUser();

    return { itemTypes: await getItemTypeCounts(user), user };
}
