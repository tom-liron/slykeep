import "server-only";

import { ITEM_TYPE_CATALOG, isIconName } from "@/config/item-type-catalog";
import type {
    CollectionViewModel,
    DashboardViewModel,
    ItemSummaryViewModel,
    ItemTypeViewModel,
    UserViewModel,
} from "@/types/view-models";
import type {
    MockCollectionRecord,
    MockItemRecord,
    MockItemTypeRecord,
    MockUserRecord,
} from "./records";

type ItemTypeMap = ReadonlyMap<string, ItemTypeViewModel>;

function toTime(value: Date | string): number {
    return value instanceof Date ? value.getTime() : Date.parse(value);
}

export function sortByUpdatedAtDesc<T extends { updatedAt: Date | string }>(records: T[]): T[] {
    return [...records].sort((left, right) => toTime(right.updatedAt) - toTime(left.updatedAt));
}

/**
 * Joins a persisted item type with its configured presentation. The persisted `icon` is an
 * untyped string, so it is validated here rather than trusted downstream.
 */
export function toItemTypeViewModel(row: MockItemTypeRecord): ItemTypeViewModel {
    if (!isIconName(row.icon)) {
        throw new Error(`Unsupported icon "${row.icon}" on item type "${row.name}"`);
    }

    const { label, slug, contentType, isPro } = ITEM_TYPE_CATALOG[row.name];

    return {
        id: row.id,
        name: row.name,
        label,
        icon: row.icon,
        color: row.color,
        slug,
        contentType,
        isPro,
    };
}

function requireItemType(itemTypeId: string, itemTypesById: ItemTypeMap): ItemTypeViewModel {
    const itemType = itemTypesById.get(itemTypeId);
    if (!itemType) {
        throw new Error(`Unknown item type: ${itemTypeId}`);
    }
    return itemType;
}

/** Null when the collection is empty and has no default type. */
export function resolveDominantTypeId(
    collection: MockCollectionRecord,
    collectionItems: MockItemRecord[],
): string | null {
    if (collectionItems.length === 0) {
        return collection.defaultTypeId;
    }

    const counts = new Map<string, number>();
    for (const item of collectionItems) {
        counts.set(item.itemTypeId, (counts.get(item.itemTypeId) ?? 0) + 1);
    }

    const highestCount = Math.max(...counts.values());
    const tiedTypeIds = new Set(
        [...counts.entries()]
            .filter(([, count]) => count === highestCount)
            .map(([itemTypeId]) => itemTypeId),
    );

    return (
        sortByUpdatedAtDesc(collectionItems).find((item) => tiedTypeIds.has(item.itemTypeId))
            ?.itemTypeId ?? collection.defaultTypeId
    );
}

export function buildItemSummaryViewModel(
    item: MockItemRecord,
    itemTypesById: ItemTypeMap,
): ItemSummaryViewModel {
    return {
        id: item.id,
        title: item.title,
        description: item.description ?? "",
        tags: [...item.tags],
        isFavorite: item.isFavorite,
        isPinned: item.isPinned,
        updatedAt: item.updatedAt.toISOString(),
        itemType: requireItemType(item.itemTypeId, itemTypesById),
    };
}

export function buildCollectionViewModel(
    collection: MockCollectionRecord,
    collectionItems: MockItemRecord[],
    itemTypesById: ItemTypeMap,
): CollectionViewModel {
    const dominantTypeId = resolveDominantTypeId(collection, collectionItems);

    const containedTypeIds = new Set(collectionItems.map((item) => item.itemTypeId));
    if (containedTypeIds.size === 0 && collection.defaultTypeId) {
        containedTypeIds.add(collection.defaultTypeId);
    }

    return {
        id: collection.id,
        name: collection.name,
        description: collection.description ?? "",
        isFavorite: collection.isFavorite,
        updatedAt: collection.updatedAt.toISOString(),
        itemCount: collectionItems.length,
        itemTypes: [...itemTypesById.values()].filter((itemType) =>
            containedTypeIds.has(itemType.id),
        ),
        dominantItemType: dominantTypeId ? requireItemType(dominantTypeId, itemTypesById) : null,
    };
}

export function buildUserViewModel(user: MockUserRecord): UserViewModel {
    return {
        id: user.id,
        name: user.name ?? user.email,
        email: user.email,
        image: user.image,
        isPro: user.isPro,
    };
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
