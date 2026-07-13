/**
 * Derived selectors and formatting helpers for the dashboard main area.
 * All values come from the mock data until the database is wired up.
 */

import { collections, items, itemTypes, type Item, type ItemType } from "@/lib/mock-data";

/** Fast lookup of an item type by id. */
const typeById = new Map(itemTypes.map((type) => [type.id, type]));

export function getType(id: string): ItemType | undefined {
  return typeById.get(id);
}

/** Format an ISO date (yyyy-mm-dd) as e.g. "Jan 15". */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** Items sorted most-recently-updated first, capped at `limit`. */
export function recentItems(limit = 10): Item[] {
  return [...items].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, limit);
}

/** Pinned items, most-recently-updated first. */
export function pinnedItems(): Item[] {
  return items.filter((item) => item.isPinned).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** Summary counts shown in the stat cards. */
export function dashboardStats() {
  return {
    totalItems: itemTypes.reduce((sum, type) => sum + type.count, 0),
    totalCollections: collections.length,
    favoriteItems: items.filter((item) => item.isFavorite).length,
    favoriteCollections: collections.filter((c) => c.isFavorite).length,
  };
}
