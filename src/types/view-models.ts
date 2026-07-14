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

export interface DashboardStats {
    totalItems: number;
    totalCollections: number;
    favoriteItems: number;
    favoriteCollections: number;
}

export interface DashboardViewModel {
    stats: DashboardStats;
    recentlyUpdatedCollections: CollectionViewModel[];
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
    itemCount: number;
    isFavorite: boolean;
}

export interface SidebarViewModel {
    itemTypes: SidebarItemTypeViewModel[];
    favoriteCollections: SidebarCollectionViewModel[];
    recentNonFavoriteCollections: SidebarCollectionViewModel[];
    user: UserViewModel;
}

export interface ItemTypePageViewModel {
    itemType: ItemTypeViewModel;
    items: ItemSummaryViewModel[];
}

export interface CollectionPageViewModel {
    collection: CollectionViewModel;
    items: ItemSummaryViewModel[];
}
