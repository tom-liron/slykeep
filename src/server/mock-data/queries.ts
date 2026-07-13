import "server-only";

import {
    SYSTEM_ITEM_TYPE_BY_ID,
    SYSTEM_ITEM_TYPE_CATALOG,
    getSystemItemTypeBySlug,
} from "@/config/item-type-catalog";
import type {
    CollectionPageViewModel,
    CollectionViewModel,
    DashboardViewModel,
    ItemTypePageViewModel,
    SidebarCollectionViewModel,
    SidebarViewModel,
} from "@/types/view-models";
import { collectionRecords, currentUserRecord, itemRecords } from "./records";
import {
    buildCollectionViewModel,
    buildDashboardViewModel,
    buildItemViewModel,
    buildUserViewModel,
    sortByUpdatedAtDesc,
} from "./view-models";

const itemViewModels = itemRecords.map((item) => buildItemViewModel(item, SYSTEM_ITEM_TYPE_BY_ID));
const itemViewModelsById = new Map(itemViewModels.map((item) => [item.id, item]));

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
        SYSTEM_ITEM_TYPE_BY_ID,
    ),
);
const collectionViewModelsById = new Map(
    collectionViewModels.map((collection) => [collection.id, collection]),
);

const itemCountByTypeId = new Map<string, number>();
for (const item of itemRecords) {
    itemCountByTypeId.set(item.typeId, (itemCountByTypeId.get(item.typeId) ?? 0) + 1);
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
    return buildDashboardViewModel(itemViewModels, collectionViewModels);
}

export async function getSidebarData(): Promise<SidebarViewModel> {
    const sortedCollections = sortByUpdatedAtDesc(collectionViewModels);

    return {
        itemTypes: SYSTEM_ITEM_TYPE_CATALOG.map((itemType) => ({
            id: itemType.id,
            name: itemType.name,
            icon: itemType.icon,
            color: itemType.color,
            slug: itemType.slug,
            itemCount: itemCountByTypeId.get(itemType.id) ?? 0,
        })),
        favoriteCollections: sortedCollections
            .filter((collection) => collection.isFavorite)
            .map(toSidebarCollection),
        recentCollections: sortedCollections
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
        .map((item) => itemViewModelsById.get(item.id))
        .filter((item) => item !== undefined);

    return {
        collection,
        items: sortByUpdatedAtDesc(items),
    };
}

export async function getItemTypePageData(
    slug: string,
): Promise<ItemTypePageViewModel | undefined> {
    const itemType = getSystemItemTypeBySlug(slug);
    if (!itemType) {
        return undefined;
    }

    return {
        itemType,
        items: sortByUpdatedAtDesc(
            itemViewModels.filter((item) => item.itemType.id === itemType.id),
        ),
    };
}
