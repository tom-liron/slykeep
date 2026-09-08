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
 * The builders that turn database rows into the presentation models the UI renders.
 *
 * The far side of the persistence boundary: the query modules in `server/` read rows, these
 * functions derive the display values from them, and pages and components receive only the types in
 * `types/view-models.ts`. Nullable columns collapse into display-safe values here, `Date` becomes an
 * ISO string here, an item type is joined with its catalog presentation here, and a collection's
 * dominant type, contained types and counts are computed here.
 *
 * A rule that more than one surface has to agree on belongs in this module rather than in the query
 * that happens to need it first: {@link requireItemType} and {@link buildCollectionSummary} are the
 * shared derivations the sidebar, the favourites list and the collection cards all build on, so the
 * dominant-type and item-type edge cases resolve the same way for each.
 *
 * @remarks
 * Inputs are declared structurally rather than against Prisma's generated types, so these rules stay
 * decoupled from the persistence shape and are testable with plain fixtures. Each row interface
 * lists only the columns a view model reads — none of them an item body, which keeps list queries
 * off the large `content` column. The one adapter that does take a Prisma payload, `toItemSummaries`,
 * lives in `items.ts` beside the `select` that produces it.
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
 * All a collection's derived metadata — dominant type, contained types, count — depends on.
 *
 * @remarks
 * `editedAt` rather than `updatedAt`: the one thing it decides is which of two tied types wins the
 * dominant slot, which is a question about item content. Favouriting an item would otherwise be able
 * to recolour a collection.
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
    emailVerified: Date | null;
}

/** Item types keyed by id, as every builder here resolves an item's or collection's type. */
export type ItemTypeMap = ReadonlyMap<string, ItemTypeViewModel>;

function toTime(value: Date | string): number {
    return value instanceof Date ? value.getTime() : Date.parse(value);
}

/** Most recently edited first. Accepts either a `Date` or an already-serialized ISO string. */
export function sortByEditedAtDesc<T extends { editedAt: Date | string }>(records: T[]): T[] {
    return [...records].sort((left, right) => toTime(right.editedAt) - toTime(left.editedAt));
}

/**
 * Joins a persisted item type with its configured presentation from
 * {@link ITEM_TYPE_CATALOG}.
 *
 * @throws When `name` names no catalog entry, or `icon` is not a supported icon.
 *
 * @remarks
 * Both columns are untyped text in the database, so this boundary is where they are checked rather
 * than trusted downstream — it is what lets every consumer of `ItemTypeViewModel` index an icon map
 * without a fallback branch.
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
 * Resolves an item type by id, for every surface that renders one.
 *
 * @throws When the id resolves to nothing.
 *
 * @remarks
 * Throwing is the same rule {@link toItemTypeViewModel} follows: an item type id that resolves to
 * nothing is a row referring to something that does not exist, not a display problem, and the page
 * cannot be rendered correctly either way. Exported so that every surface answering this question
 * answers it identically — a `?? null` at one call site and a throw at another turns one fault into
 * two different symptoms.
 */
export function requireItemType(itemTypeId: string, itemTypesById: ItemTypeMap): ItemTypeViewModel {
    const itemType = itemTypesById.get(itemTypeId);
    if (!itemType) {
        throw new Error(`Unknown item type: ${itemTypeId}`);
    }
    return itemType;
}

/**
 * The most common item type in the collection. Ties are broken by the most recently edited item
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

    // The most recently edited item whose type is tied for the lead settles the tie.
    return (
        sortByEditedAtDesc(collectionItems).find((item) => tiedTypeIds.has(item.itemTypeId))
            ?.itemTypeId ?? collection.defaultTypeId
    );
}

/** One item as a card or list row renders it. Nullable columns become display-safe values. */
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
 * One item with the body and membership the detail drawer adds.
 *
 * Builds on the summary rather than repeating it, so the nullable-to-display-safe rules the two
 * share — description, tags, the ISO timestamps — have one definition.
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

/**
 * What every surface showing a collection needs: its name, how many items it holds, and the type
 * that colours it.
 *
 * The sidebar, the favourites list and the collection cards all start here and add their own fields
 * on top — the sidebar `isFavorite`, the favourites list `updatedAt`, and the card both plus a
 * description and its icon strip. Sharing the derivation is what keeps the three from disagreeing
 * about an unresolvable dominant type.
 */
export function buildCollectionSummary(
    collection: Pick<CollectionRow, "id" | "name" | "defaultTypeId">,
    collectionItems: CollectionItemRow[],
    itemTypesById: ItemTypeMap,
): { id: string; name: string; itemCount: number; dominantItemType: ItemTypeViewModel | null } {
    const dominantTypeId = resolveDominantTypeId(collection, collectionItems);

    return {
        id: collection.id,
        name: collection.name,
        itemCount: collectionItems.length,
        dominantItemType: dominantTypeId ? requireItemType(dominantTypeId, itemTypesById) : null,
    };
}

/** A collection as a card renders it: the shared summary, plus description, date and type strip. */
export function buildCollectionViewModel(
    collection: CollectionRow,
    collectionItems: CollectionItemRow[],
    itemTypesById: ItemTypeMap,
): CollectionViewModel {
    const containedTypeIds = new Set(collectionItems.map((item) => item.itemTypeId));
    // An empty collection shows its default type, so the card is not blank before anything is filed.
    if (containedTypeIds.size === 0 && collection.defaultTypeId) {
        containedTypeIds.add(collection.defaultTypeId);
    }

    return {
        ...buildCollectionSummary(collection, collectionItems, itemTypesById),
        description: collection.description ?? "",
        isFavorite: collection.isFavorite,
        updatedAt: collection.updatedAt.toISOString(),
        itemTypes: [...itemTypesById.values()].filter((itemType) =>
            containedTypeIds.has(itemType.id),
        ),
    };
}

/**
 * How a set of items divides by type, most numerous first with ties broken by label, for the
 * breakdown on a collection's page.
 *
 * Only types actually present appear — a breakdown of what is in this collection, not a checklist of
 * every type the user could file there, which is what the sidebar and profile lists want instead.
 *
 * @remarks
 * The sort makes the output deterministic. `itemTypesById` comes from an unordered `findMany`, so an
 * order inherited from its iteration would differ between requests and reshuffle the row under the
 * title. `buildCollectionViewModel`'s `itemTypes` has the same exposure and is left unsorted: the
 * card renders it as an unlabelled icon strip, where a reshuffle costs nothing.
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

/** The signed-in account for display. An account with no name is shown by its address. */
export function buildUserViewModel(user: UserRow): UserViewModel {
    return {
        id: user.id,
        name: user.name ?? user.email,
        email: user.email,
        image: user.image,
        isPro: user.isPro,
        emailVerified: user.emailVerified !== null,
    };
}
