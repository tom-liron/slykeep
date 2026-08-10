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

/**
 * Item data prepared for cards and lists, independent of the persistence layer.
 *
 * The file pair and `createdAt` live here rather than only on the detail model because the file list
 * describes an item by its object — name, size, and the date it was uploaded — before anything has
 * been opened. They are three small scalars, not a body: the rule that list queries never read
 * `content` / `url` / `fileKey` is unchanged. Every non-FILE item carries the empty values, the same
 * way the detail model has always described an item whose content lives in a different column.
 */
export interface ItemSummaryViewModel {
    id: string;
    title: string;
    description: string;
    tags: string[];
    isFavorite: boolean;
    isPinned: boolean;
    updatedAt: string;
    createdAt: string;
    /** Original filename of a FILE item's object. Empty when the item has no file. */
    fileName: string;
    /** Size of that object in bytes. Zero when the item has no file. */
    fileSize: number;
    itemType: ItemTypeViewModel;
}

/**
 * A single item with everything the detail drawer renders on top of what its card already showed.
 *
 * It extends the summary rather than restating it, because the drawer opens over the card it was
 * clicked on and shows the same title, tags, and type alongside the body. The body is the reason
 * this type is separate at all: list queries deliberately never select `content` / `url`, so this is
 * the only item view model that carries one.
 *
 * `content` and `url` are both present because which one holds the body is decided by the item's
 * content type — `itemType.contentType` says which to read, and the other is empty. A FILE item's
 * object is already described by the summary's `fileName` / `fileSize`; the R2 key is deliberately
 * absent everywhere: the drawer reads the object from `/api/files/<item id>`, which resolves the key
 * itself from a row it has already authorized, so sending one to the browser would only invite it
 * back as input.
 */
export interface ItemDetailViewModel extends ItemSummaryViewModel {
    content: string;
    url: string;
    /** Code language for a TEXT item, e.g. "typescript". Empty when the item declares none. */
    language: string;
    /** The collections holding this item. Empty when it belongs to none. */
    collections: CollectionOptionViewModel[];
}

/**
 * A collection reduced to what it takes to name one and submit it back: the drawer renders the name,
 * and the item forms preselect and post the id.
 *
 * Ids rather than names alone is what the membership editor needs — `ItemDetailViewModel.collections`
 * used to carry names only, which is enough to *show* where an item lives but not to check the boxes
 * for it, since a name is not what `ItemCollection` points at.
 */
export interface CollectionOptionViewModel {
    id: string;
    name: string;
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
