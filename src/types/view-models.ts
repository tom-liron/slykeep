import type { ItemTypeMetadata } from "./item-type";

/** Item data prepared for rendering, independent of the persistence layer. */
export interface ItemViewModel {
    id: string;
    title: string;
    description: string;
    content: string;
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
    recentCollections: CollectionViewModel[];
    pinnedItems: ItemViewModel[];
    recentItems: ItemViewModel[];
}

export type SidebarItemTypeViewModel = ItemTypeMetadata & {
    itemCount: number;
};

export interface SidebarCollectionViewModel {
    id: string;
    name: string;
    itemCount: number;
    isFavorite: boolean;
}

export interface SidebarViewModel {
    itemTypes: SidebarItemTypeViewModel[];
    favoriteCollections: SidebarCollectionViewModel[];
    recentCollections: SidebarCollectionViewModel[];
    user: UserViewModel;
}

export interface ItemTypePageViewModel {
    itemType: ItemTypeMetadata;
    items: ItemViewModel[];
}

export interface CollectionPageViewModel {
    collection: CollectionViewModel;
    items: ItemViewModel[];
}
