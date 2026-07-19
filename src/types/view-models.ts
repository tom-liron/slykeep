import type { ContentType, IconName, ItemTypeName } from "./item-type";

/**
 * A persisted item type joined with its configured presentation. Built at the server boundary by
 * `toItemTypeViewModel`, which is where the untyped persisted `icon` is validated.
 */
export interface ItemTypeViewModel {
    id: string;
    name: ItemTypeName;
    label: string;
    icon: IconName;
    color: string;
    slug: string;
    contentType: ContentType;
    isPro: boolean;
}

/** Item data prepared for cards and lists, independent of the persistence layer. */
export interface ItemSummaryViewModel {
    id: string;
    title: string;
    description: string;
    tags: string[];
    isFavorite: boolean;
    isPinned: boolean;
    updatedAt: string;
    itemType: ItemTypeViewModel;
}

/**
 * Collection data prepared with all derived display metadata. A collection with no items and no
 * default type has no dominant type, so `dominantItemType` is nullable.
 */
export interface CollectionViewModel {
    id: string;
    name: string;
    description: string;
    isFavorite: boolean;
    updatedAt: string;
    itemCount: number;
    itemTypes: ItemTypeViewModel[];
    dominantItemType: ItemTypeViewModel | null;
}

export interface UserViewModel {
    id: string;
    name: string;
    email: string;
    image: string | null;
    isPro: boolean;
}

/**
 * The dashboard is sourced in two halves while the items layer is still mock-backed: collections
 * come from the database, items do not. Keeping them apart means the items half can be swapped
 * later without touching the page's collection wiring.
 */
export interface DashboardCollectionsViewModel {
    totalCollections: number;
    favoriteCollections: number;
    recentCollections: CollectionViewModel[];
}

export interface DashboardItemsViewModel {
    totalItems: number;
    favoriteItems: number;
    pinnedItems: ItemSummaryViewModel[];
    recentItems: ItemSummaryViewModel[];
}

export interface SidebarItemTypeViewModel {
    id: string;
    label: string;
    icon: IconName;
    color: string;
    slug: string;
    itemCount: number;
}

export interface SidebarCollectionViewModel {
    id: string;
    name: string;
    isFavorite: boolean;
    itemCount: number;
    /** Drives the recent-collection colour dot. Null when the collection has no dominant type. */
    dominantItemType: ItemTypeViewModel | null;
}

/** The sidebar's collection lists, read from the database. */
export interface SidebarCollectionsViewModel {
    favoriteCollections: SidebarCollectionViewModel[];
    recentNonFavoriteCollections: SidebarCollectionViewModel[];
}

/** Item types (with per-user item counts) and the signed-in user, read from the database. */
export interface SidebarNavViewModel {
    itemTypes: SidebarItemTypeViewModel[];
    user: UserViewModel;
}

export type SidebarViewModel = SidebarNavViewModel & SidebarCollectionsViewModel;

export interface ItemTypePageViewModel {
    itemType: ItemTypeViewModel;
    items: ItemSummaryViewModel[];
}

export interface CollectionPageViewModel {
    collection: CollectionViewModel;
    items: ItemSummaryViewModel[];
}
