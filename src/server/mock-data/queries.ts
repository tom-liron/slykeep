import "server-only";

import { getItemTypeNameBySlug } from "@/config/item-type-catalog";
import { canAccessItemType } from "@/lib/limits";
import type { ItemTypePageViewModel, SidebarNavViewModel } from "@/types/view-models";
import {
    buildItemSummaryViewModel,
    buildUserViewModel,
    sortByUpdatedAtDesc,
    toItemTypeViewModel,
} from "../view-models";
import { currentUserRecord, itemRecords, itemTypeRecords } from "./records";

/**
 * The sidebar nav (item types + user) and item-type pages, still backed by mock records. The
 * dashboard items read path now comes from the database (`src/server/items.ts`); this module is
 * what remains to be replaced.
 */

const itemTypes = itemTypeRecords.map(toItemTypeViewModel);
const itemTypesById = new Map(itemTypes.map((itemType) => [itemType.id, itemType]));
const itemTypesByName = new Map(itemTypes.map((itemType) => [itemType.name, itemType]));

const itemSummaries = itemRecords.map((item) => buildItemSummaryViewModel(item, itemTypesById));

const itemCountByTypeId = new Map<string, number>();
for (const item of itemRecords) {
    itemCountByTypeId.set(item.itemTypeId, (itemCountByTypeId.get(item.itemTypeId) ?? 0) + 1);
}

/** The sidebar's item types and user. Its collection lists come from the database. */
export async function getSidebarNav(): Promise<SidebarNavViewModel> {
    return {
        itemTypes: itemTypes
            .filter((itemType) => canAccessItemType(currentUserRecord.isPro, itemType.isPro))
            .map((itemType) => ({
                id: itemType.id,
                label: itemType.label,
                icon: itemType.icon,
                color: itemType.color,
                slug: itemType.slug,
                itemCount: itemCountByTypeId.get(itemType.id) ?? 0,
            })),
        user: buildUserViewModel(currentUserRecord),
    };
}

export async function getItemTypePageData(
    slug: string,
): Promise<ItemTypePageViewModel | undefined> {
    const name = getItemTypeNameBySlug(slug);
    const itemType = name ? itemTypesByName.get(name) : undefined;
    if (!itemType) {
        return undefined;
    }
    if (!canAccessItemType(currentUserRecord.isPro, itemType.isPro)) {
        return undefined;
    }

    return {
        itemType,
        items: sortByUpdatedAtDesc(
            itemSummaries.filter((item) => item.itemType.id === itemType.id),
        ),
    };
}
