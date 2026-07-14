import "server-only";

import { prisma } from "@/lib/prisma";
import type { ItemTypeViewModel } from "@/types/view-models";
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
