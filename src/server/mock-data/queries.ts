import "server-only";

import { getItemTypeNameBySlug } from "@/config/item-type-catalog";
import { canAccessItemType } from "@/lib/limits";
import type { ItemTypePageViewModel } from "@/types/view-models";
import {
    buildItemSummaryViewModel,
    sortByUpdatedAtDesc,
    toItemTypeViewModel,
} from "../view-models";
import { currentUserRecord, itemRecords, itemTypeRecords } from "./records";

/**
 * Item-type pages, still backed by mock records. The sidebar nav and dashboard read paths now come
 * from the database; the `/items/[slug]` pages are what remains to be replaced here.
 */

const itemTypes = itemTypeRecords.map(toItemTypeViewModel);
const itemTypesById = new Map(itemTypes.map((itemType) => [itemType.id, itemType]));
const itemTypesByName = new Map(itemTypes.map((itemType) => [itemType.name, itemType]));

const itemSummaries = itemRecords.map((item) => buildItemSummaryViewModel(item, itemTypesById));

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
