import "server-only";

import { SYSTEM_ITEM_TYPE_NAMES } from "@/config/item-type-catalog";
import { canAccessItemType } from "@/lib/limits";
import { prisma } from "@/lib/prisma";
import type { ItemTypeViewModel, SidebarNavViewModel } from "@/types/view-models";
import { getCurrentUser } from "./current-user";
import { toItemTypeViewModel } from "./view-models";

/**
 * The item types a user can see: the system types (`userId: null`) plus any custom types they own.
 * Returned as a map because callers resolve types by the foreign key on an item or collection.
 */
export async function getItemTypesById(
    userId: string,
): Promise<ReadonlyMap<string, ItemTypeViewModel>> {
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
}

/**
 * The sidebar nav: the system item types the user can access — in catalog order, each with a live
 * item count — plus the signed-in user. Custom types are intentionally excluded; the sidebar lists
 * system types only.
 */
export async function getSidebarNav(): Promise<SidebarNavViewModel> {
    const user = await getCurrentUser();

    const [typeRows, counts] = await Promise.all([
        prisma.itemType.findMany({
            where: { OR: [{ userId: null }, { userId: user.id }] },
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

    const itemTypes = SYSTEM_ITEM_TYPE_NAMES.flatMap((name) => {
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
        }));

    return { itemTypes, user };
}
