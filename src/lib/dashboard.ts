/**
 * Dashboard data selectors.
 *
 * All counts are derived from the single `items` / `collections` source in
 * @/lib/mock-data, so every number on the dashboard reconciles. When the
 * database lands, these graduate to async data-access functions in `server/`.
 */

import { collections, items } from "@/lib/mock-data";
import type { Collection, Item } from "@/types/item";

/** Items sorted most-recently-updated first, capped at `limit`. */
export function getRecentItems(limit = 10): Item[] {
    return [...items].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, limit);
}

/** Pinned items, most-recently-updated first. */
export function getPinnedItems(): Item[] {
    return items
        .filter((item) => item.isPinned)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** Number of items of a given type. */
export function getItemCountByType(typeId: string): number {
    return items.filter((item) => item.typeId === typeId).length;
}

/** Number of items in a given collection. */
export function getItemCountInCollection(collectionId: string): number {
    return items.filter((item) => item.collectionIds.includes(collectionId)).length;
}

/** Favorite collections (sidebar "Favorites"). */
export function getFavoriteCollections(): Collection[] {
    return collections.filter((collection) => collection.isFavorite);
}

/** Non-favorite collections, capped at `limit` (sidebar "Recent"). */
export function getRecentCollections(limit: number): Collection[] {
    return collections.filter((collection) => !collection.isFavorite).slice(0, limit);
}

/** Collections for the dashboard grid, capped at `limit`. */
export function getLatestCollections(limit = 6): Collection[] {
    return collections.slice(0, limit);
}

/** Summary counts shown in the stat cards. */
export function getDashboardStats() {
    return {
        totalItems: items.length,
        totalCollections: collections.length,
        favoriteItems: items.filter((item) => item.isFavorite).length,
        favoriteCollections: collections.filter((collection) => collection.isFavorite).length,
    };
}
