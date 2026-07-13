import type { IconName, ItemTypeMetadata } from "./item-type";

/** Item data prepared for cards and lists, independent of the persistence layer. */
export interface ItemSummaryViewModel {
    id: string;
    title: string;
    description: string;
    tags: string[];
    isFavorite: boolean;
    isPinned: boolean;
    updatedAt: string;
    itemType: ItemTypeMetadata;
}

/** Collection data prepared with all derived display metadata. */
export interface CollectionViewModel {
    id: string;
    name: string;
    description: string;
    isFavorite: boolean;
    updatedAt: string;
    itemCount: number;
    itemTypes: ItemTypeMetadata[];
    dominantItemType: ItemTypeMetadata;
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
    name: string;
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
    itemType: ItemTypeMetadata;
    items: ItemSummaryViewModel[];
}

export interface CollectionPageViewModel {
    collection: CollectionViewModel;
    items: ItemSummaryViewModel[];
}
