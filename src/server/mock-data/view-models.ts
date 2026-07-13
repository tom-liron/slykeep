import "server-only";

import type { ItemTypeMetadata } from "@/types/item-type";
import type {
    CollectionViewModel,
    DashboardViewModel,
    ItemSummaryViewModel,
    UserViewModel,
} from "@/types/view-models";
import type { MockCollectionRecord, MockItemRecord, MockUserRecord } from "./records";

type ItemTypeMap = ReadonlyMap<string, ItemTypeMetadata>;

export function sortByUpdatedAtDesc<T extends { updatedAt: string }>(records: T[]): T[] {
    return [...records].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export function resolveDominantTypeId(
    collection: MockCollectionRecord,
    collectionItems: MockItemRecord[],
): string {
    if (collectionItems.length === 0) {
        return collection.defaultTypeId;
    }

    const counts = new Map<string, number>();
    for (const item of collectionItems) {
        counts.set(item.typeId, (counts.get(item.typeId) ?? 0) + 1);
    }

    const highestCount = Math.max(...counts.values());
    const tiedTypeIds = new Set(
        [...counts.entries()]
            .filter(([, count]) => count === highestCount)
            .map(([typeId]) => typeId),
    );

    return (
        sortByUpdatedAtDesc(collectionItems).find((item) => tiedTypeIds.has(item.typeId))?.typeId ??
        collection.defaultTypeId
    );
}

export function buildItemSummaryViewModel(
    item: MockItemRecord,
    itemTypesById: ItemTypeMap,
): ItemSummaryViewModel {
    const itemType = itemTypesById.get(item.typeId);
    if (!itemType) {
        throw new Error(`Unknown item type: ${item.typeId}`);
    }

    return {
        id: item.id,
        title: item.title,
        description: item.description,
        tags: [...item.tags],
        isFavorite: item.isFavorite,
        isPinned: item.isPinned,
        updatedAt: item.updatedAt,
        itemType,
    };
}

export function buildCollectionViewModel(
    collection: MockCollectionRecord,
    collectionItems: MockItemRecord[],
    itemTypesById: ItemTypeMap,
): CollectionViewModel {
    const dominantTypeId = resolveDominantTypeId(collection, collectionItems);
    const dominantItemType = itemTypesById.get(dominantTypeId);
    if (!dominantItemType) {
        throw new Error(`Unknown item type: ${dominantTypeId}`);
    }

    const containedTypeIds = new Set(collectionItems.map((item) => item.typeId));
    if (containedTypeIds.size === 0) {
        containedTypeIds.add(collection.defaultTypeId);
    }

    const itemTypes = [...itemTypesById.values()].filter((itemType) =>
        containedTypeIds.has(itemType.id),
    );

    return {
        id: collection.id,
        name: collection.name,
        description: collection.description,
        isFavorite: collection.isFavorite,
        updatedAt: collection.updatedAt,
        itemCount: collectionItems.length,
        itemTypes,
        dominantItemType,
    };
}

export function buildUserViewModel(user: MockUserRecord): UserViewModel {
    return { ...user };
}

export function buildDashboardViewModel(
    items: ItemSummaryViewModel[],
    collections: CollectionViewModel[],
): DashboardViewModel {
    return {
        stats: {
            totalItems: items.length,
            totalCollections: collections.length,
            favoriteItems: items.filter((item) => item.isFavorite).length,
            favoriteCollections: collections.filter((collection) => collection.isFavorite).length,
        },
        recentlyUpdatedCollections: sortByUpdatedAtDesc(collections).slice(0, 6),
        pinnedItems: sortByUpdatedAtDesc(items.filter((item) => item.isPinned)),
        recentItems: sortByUpdatedAtDesc(items.filter((item) => !item.isPinned)).slice(0, 10),
    };
}
