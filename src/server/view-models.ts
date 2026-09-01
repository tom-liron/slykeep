import "server-only";

import { ITEM_TYPE_CATALOG, isIconName, isItemTypeName } from "@/config/item-type-catalog";
import type {
    CollectionOptionViewModel,
    CollectionViewModel,
    ItemDetailViewModel,
    ItemSummaryViewModel,
    ItemTypeCountViewModel,
    ItemTypeViewModel,
    UserViewModel,
} from "@/types/view-models";

/**
 * Inputs are declared structurally rather than against Prisma's generated types, so the derivation
 * rules below stay decoupled from the persistence shape and are trivial to unit-test with plain
 * fixtures. Each row type lists only the columns a view model actually reads — notably, nothing here
 * selects an item body, which keeps list queries off the large `content` column.
 */

/** `name` and `icon` are plain strings in the database, so both are validated here. */
export interface ItemTypeRow {
    id: string;
    name: string;
    icon: string;
    color: string;
}

export interface CollectionRow {
    id: string;
    name: string;
    description: string | null;
    isFavorite: boolean;
    defaultTypeId: string | null;
    updatedAt: Date;
}

/**
 * All a collection's derived metadata (dominant type, contained types, count) depends on.
 *
 * `editedAt` rather than `updatedAt` because the one thing it decides — which of two tied types wins
 * the dominant slot — is a question about items, and every other item recency question now answers
 * with the same column. Favouriting an item would otherwise be able to recolour a collection.
 */
export interface CollectionItemRow {
    itemTypeId: string;
    editedAt: Date;
}

export interface ItemSummaryRow {
    id: string;
    title: string;
    description: string | null;
    itemTypeId: string;
    tags: readonly string[];
    isFavorite: boolean;
    isPinned: boolean;
    editedAt: Date;
    createdAt: Date;
    fileName: string | null;
    fileSize: number | null;
}

/** The summary columns plus the body and the collections the drawer adds to them. */
export interface ItemDetailRow extends ItemSummaryRow {
    content: string | null;
    url: string | null;
    language: string | null;
    collections: readonly CollectionOptionViewModel[];
}

export interface UserRow {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
    isPro: boolean;
}

type ItemTypeMap = ReadonlyMap<string, ItemTypeViewModel>;

function toTime(value: Date | string): number {
    return value instanceof Date ? value.getTime() : Date.parse(value);
}

export function sortByEditedAtDesc<T extends { editedAt: Date | string }>(records: T[]): T[] {
    return [...records].sort((left, right) => toTime(right.editedAt) - toTime(left.editedAt));
}

/**
 * Joins a persisted item type with its configured presentation. `name` and `icon` are untyped in
 * the database, so this boundary is where they are checked rather than trusted downstream.
 */
export function toItemTypeViewModel(row: ItemTypeRow): ItemTypeViewModel {
    if (!isItemTypeName(row.name)) {
        throw new Error(`Unknown item type "${row.name}" — no entry in the item type catalog`);
    }
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

/**
 * Exported so the surfaces that resolve a *dominant* type outside this module resolve it the same
 * way. `collections.ts` used to answer the identical question with `itemTypesById.get(id) ?? null`
 * on two of its three call sites, which meant one dangling type id was a 500 on the collection
 * cards and a colourless dot in the sidebar beside them — the same fault reported two ways,
 * undocumented, with nothing choosing between them.
 *
 * It throws, on the same grounds `toItemTypeViewModel` does: an item type id that resolves to
 * nothing is not a display problem, it is a row referring to something that does not exist, and the
 * page cannot be rendered correctly either way. The neutral dot bought nothing in practice — the
 * dashboard and the collections list already threw on the very same data, so a sidebar that
 * survived it was drawn beside an error page.
 */
export function requireItemType(itemTypeId: string, itemTypesById: ItemTypeMap): ItemTypeViewModel {
    const itemType = itemTypesById.get(itemTypeId);
    if (!itemType) {
        throw new Error(`Unknown item type: ${itemTypeId}`);
    }
    return itemType;
}

/**
 * The most common item type in the collection. Ties are broken by the most recently updated item
 * among the tied types. Null when the collection is empty and has no default type.
 */
export function resolveDominantTypeId(
    collection: Pick<CollectionRow, "defaultTypeId">,
    collectionItems: CollectionItemRow[],
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
        sortByEditedAtDesc(collectionItems).find((item) => tiedTypeIds.has(item.itemTypeId))
            ?.itemTypeId ?? collection.defaultTypeId
    );
}

export function buildItemSummaryViewModel(
    item: ItemSummaryRow,
    itemTypesById: ItemTypeMap,
): ItemSummaryViewModel {
    return {
        id: item.id,
        title: item.title,
        description: item.description ?? "",
        tags: [...item.tags],
        isFavorite: item.isFavorite,
        isPinned: item.isPinned,
        editedAt: item.editedAt.toISOString(),
        createdAt: item.createdAt.toISOString(),
        fileName: item.fileName ?? "",
        fileSize: item.fileSize ?? 0,
        itemType: requireItemType(item.itemTypeId, itemTypesById),
    };
}

/**
 * Builds on the summary rather than repeating it, so the nullable-to-display-safe rules the two
 * share — description, tags, the ISO timestamp — stay defined once.
 */
export function buildItemDetailViewModel(
    item: ItemDetailRow,
    itemTypesById: ItemTypeMap,
): ItemDetailViewModel {
    return {
        ...buildItemSummaryViewModel(item, itemTypesById),
        content: item.content ?? "",
        url: item.url ?? "",
        language: item.language ?? "",
        collections: item.collections.map(({ id, name }) => ({ id, name })),
    };
}

export function buildCollectionViewModel(
    collection: CollectionRow,
    collectionItems: CollectionItemRow[],
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

/**
 * How a set of items divides by type, most numerous first with ties broken by label.
 *
 * Only types that are actually present appear — a breakdown of what is in one collection, not a
 * checklist of every type the user could file there, which is the opposite of what the sidebar and
 * profile lists want from their counts.
 *
 * The sort is what makes the output deterministic: `itemTypesById` comes from an unordered
 * `findMany`, so an order inherited from its iteration would differ between requests and reshuffle
 * the row under the title for no reason. `buildCollectionViewModel`'s `itemTypes` has the same
 * exposure and is left alone — the card renders it as an unlabelled icon strip, where the cost of a
 * reshuffle is nil.
 */
export function buildItemTypeBreakdown(
    collectionItems: readonly Pick<CollectionItemRow, "itemTypeId">[],
    itemTypesById: ItemTypeMap,
): ItemTypeCountViewModel[] {
    const countsByTypeId = new Map<string, number>();
    for (const item of collectionItems) {
        countsByTypeId.set(item.itemTypeId, (countsByTypeId.get(item.itemTypeId) ?? 0) + 1);
    }

    return [...countsByTypeId]
        .map(([itemTypeId, itemCount]) => {
            const { id, label, icon, color, slug, isPro } = requireItemType(
                itemTypeId,
                itemTypesById,
            );
            return { id, label, icon, color, slug, itemCount, isPro };
        })
        .sort(
            (left, right) =>
                right.itemCount - left.itemCount || left.label.localeCompare(right.label),
        );
}

export function buildUserViewModel(user: UserRow): UserViewModel {
    return {
        id: user.id,
        name: user.name ?? user.email,
        email: user.email,
        image: user.image,
        isPro: user.isPro,
    };
}
