import "server-only";

import { cache } from "react";

import { SYSTEM_ITEM_TYPE_NAMES } from "@/config/item-type-catalog";
import { canAccessItemType } from "@/lib/limits";
import { prisma } from "@/lib/prisma";
import type {
    ItemTypeCountViewModel,
    ItemTypeViewModel,
    SidebarNavViewModel,
    UserViewModel,
} from "@/types/view-models";
import { getCurrentUser } from "./current-user";
import { toItemTypeViewModel } from "./view-models";

/**
 * The item types a user can see: the system types (`userId: null`) plus any custom types they own.
 * Returned as a map because callers resolve types by the foreign key on an item or collection.
 */
export const getItemTypesById = cache(
    async (userId: string): Promise<ReadonlyMap<string, ItemTypeViewModel>> => {
        const rows = await prisma.itemType.findMany({
            where: { OR: [{ userId: null }, { userId }] },
            select: { id: true, name: true, icon: true, color: true },
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
 * The system item types a user can access, in catalog order, each with a live item count. Custom
 * types are intentionally excluded — both callers list system types only.
 *
 * One `groupBy` rather than a count per type, and the `?? 0` is what keeps a type the user has no
 * items of in the list: `groupBy` returns no row for an empty group, so the zero has to come from
 * the catalog side of the join. Shared by the sidebar nav and the profile page's breakdown.
 */
export async function getItemTypeCounts(user: UserViewModel): Promise<ItemTypeCountViewModel[]> {
    const [typeRows, counts] = await Promise.all([
        prisma.itemType.findMany({
            // System rows only, which is what the doc comment above already promises. Reading the
            // user's custom types too and then keying them by `name` below would let a custom type
            // sharing a system name overwrite it in the map — the same hazard as a `findUnique` on
            // `name` alone, which `CLAUDE.md` and the partial index in `schema.prisma` both warn
            // about: `name` is unique only among system rows.
            where: { userId: null },
            select: { id: true, name: true, icon: true, color: true },
        }),
        prisma.item.groupBy({
            by: ["itemTypeId"],
            where: { userId: user.id },
            _count: { _all: true },
        }),
    ]);

    const countByTypeId = new Map(counts.map((row) => [row.itemTypeId, row._count._all]));
    const rowByName = new Map(typeRows.map((row) => [row.name, row]));

    return SYSTEM_ITEM_TYPE_NAMES.flatMap((name) => {
        const row = rowByName.get(name);
        return row ? [toItemTypeViewModel(row)] : [];
    })
        .filter((itemType) => canAccessItemType(user.isPro, itemType.isPro))
        .map((itemType) => ({
            id: itemType.id,
            label: itemType.label,
            icon: itemType.icon,
            color: itemType.color,
            slug: itemType.slug,
            itemCount: countByTypeId.get(itemType.id) ?? 0,
            isPro: itemType.isPro,
        }));
}

/** The sidebar nav: the accessible system item types with their counts, plus the signed-in user. */
export async function getSidebarNav(): Promise<SidebarNavViewModel> {
    const user = await getCurrentUser();

    return { itemTypes: await getItemTypeCounts(user), user };
}
