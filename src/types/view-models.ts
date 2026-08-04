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
 * The dashboard's collection and item data are prepared as two independent view models, each by its
 * own server query module. Keeping them apart lets either half evolve without touching the other's
 * wiring on the page.
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

/**
 * An item type reduced to what a count display needs: its presentation, and how many of the user's
 * items carry it. Shared by the sidebar nav and the profile page's type breakdown, which ask the
 * same question of the same data and would otherwise keep two identical shapes in step by hand.
 */
export interface ItemTypeCountViewModel {
    id: string;
    label: string;
    icon: IconName;
    color: string;
    slug: string;
    itemCount: number;
    /** Carried through so the sidebar can mark Pro-gated types without re-reading the catalog. */
    isPro: boolean;
}

export type SidebarItemTypeViewModel = ItemTypeCountViewModel;

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

/**
 * The profile page: who the account belongs to, when it was opened, how much is in it, and which
 * of the two account actions it can offer.
 *
 * `hasPassword` is deliberately a boolean rather than the hash it derives from. The page needs to
 * know only whether a password exists — a credentials account can change one, a GitHub-only account
 * has none to change — and the hash itself must never leave the server boundary.
 */
export interface ProfileViewModel {
    user: UserViewModel;
    createdAt: string;
    hasPassword: boolean;
    totalItems: number;
    totalCollections: number;
    itemTypeCounts: ItemTypeCountViewModel[];
}

export interface ItemTypePageViewModel {
    itemType: ItemTypeViewModel;
    items: ItemSummaryViewModel[];
}

export interface CollectionPageViewModel {
    collection: CollectionViewModel;
    items: ItemSummaryViewModel[];
}
