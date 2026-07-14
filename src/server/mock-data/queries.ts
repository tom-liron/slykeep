import "server-only";

import { getItemTypeNameBySlug } from "@/config/item-type-catalog";
import { canAccessItemType } from "@/lib/limits";
import type {
    CollectionPageViewModel,
    CollectionViewModel,
    DashboardViewModel,
    ItemTypePageViewModel,
    SidebarCollectionViewModel,
    SidebarViewModel,
} from "@/types/view-models";
import { collectionRecords, currentUserRecord, itemRecords, itemTypeRecords } from "./records";
import {
    buildCollectionViewModel,
    buildDashboardViewModel,
    buildItemSummaryViewModel,
    buildUserViewModel,
    sortByUpdatedAtDesc,
    toItemTypeViewModel,
} from "./view-models";

const itemTypes = itemTypeRecords.map(toItemTypeViewModel);
const itemTypesById = new Map(itemTypes.map((itemType) => [itemType.id, itemType]));
const itemTypesByName = new Map(itemTypes.map((itemType) => [itemType.name, itemType]));

const itemSummaries = itemRecords.map((item) => buildItemSummaryViewModel(item, itemTypesById));
const itemSummariesById = new Map(itemSummaries.map((item) => [item.id, item]));

const itemsByCollectionId = new Map(
    collectionRecords.map((collection) => [
        collection.id,
        itemRecords.filter((item) => item.collectionIds.includes(collection.id)),
    ]),
);

const collectionViewModels = collectionRecords.map((collection) =>
    buildCollectionViewModel(
        collection,
        itemsByCollectionId.get(collection.id) ?? [],
        itemTypesById,
    ),
);
const collectionViewModelsById = new Map(
    collectionViewModels.map((collection) => [collection.id, collection]),
);

const itemCountByTypeId = new Map<string, number>();
for (const item of itemRecords) {
    itemCountByTypeId.set(item.itemTypeId, (itemCountByTypeId.get(item.itemTypeId) ?? 0) + 1);
}

function toSidebarCollection(collection: CollectionViewModel): SidebarCollectionViewModel {
    return {
        id: collection.id,
        name: collection.name,
        itemCount: collection.itemCount,
        isFavorite: collection.isFavorite,
    };
}

export async function getDashboardData(): Promise<DashboardViewModel> {
    return buildDashboardViewModel(itemSummaries, collectionViewModels);
}

export async function getSidebarData(): Promise<SidebarViewModel> {
    const sortedCollections = sortByUpdatedAtDesc(collectionViewModels);

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
        favoriteCollections: sortedCollections
            .filter((collection) => collection.isFavorite)
            .map(toSidebarCollection),
        recentNonFavoriteCollections: sortedCollections
            .filter((collection) => !collection.isFavorite)
            .slice(0, 5)
            .map(toSidebarCollection),
        user: buildUserViewModel(currentUserRecord),
    };
}

export async function getAllCollections(): Promise<CollectionViewModel[]> {
    return sortByUpdatedAtDesc(collectionViewModels);
}

export async function getCollectionPageData(
    collectionId: string,
): Promise<CollectionPageViewModel | undefined> {
    const collection = collectionViewModelsById.get(collectionId);
    if (!collection) {
        return undefined;
    }

    const items = (itemsByCollectionId.get(collectionId) ?? [])
        .map((item) => itemSummariesById.get(item.id))
        .filter((item) => item !== undefined);

    return {
        collection,
        items: sortByUpdatedAtDesc(items),
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
