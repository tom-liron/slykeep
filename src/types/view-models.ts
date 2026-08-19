import type { BillingCycle } from "@/config/marketing";

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
    /**
     * When the item's content last changed — what every listing sorts by and every card renders.
     * Deliberately not `updatedAt`: that column also moves when the item is favourited or pinned,
     * neither of which is an edit, so it has no reader outside the database.
     */
    editedAt: string;
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
 * An item type reduced to what a count display needs: its presentation, and how many items carry it.
 * Shared by the sidebar nav, the profile page's type breakdown, and a collection page's breakdown,
 * which ask the same question of different scopes and would otherwise keep identical shapes in step
 * by hand. What the count is *over* is the caller's: the first two count everything the user owns,
 * the collection page counts only what is in that collection.
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

/**
 * A collection as one compact row on `/favorites`: named, counted, dated, and coloured by the type
 * it mostly holds.
 *
 * Close to `SidebarCollectionViewModel` but not the same question. That one is a navigation entry —
 * it needs `isFavorite` because the sidebar splits favourites from recents, and it needs no date
 * because nothing there shows one. Here every row is a favourite by definition, so the flag would be
 * a constant, and the row does show a date. Narrower than `CollectionViewModel`, which additionally
 * derives the contained-type strip that only a card renders.
 */
export interface FavoriteCollectionViewModel {
    id: string;
    name: string;
    itemCount: number;
    updatedAt: string;
    /** Colours the row's folder icon. Null when the collection has no dominant type. */
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
 * The profile page: who the account belongs to, when it was opened, and how much is in it.
 *
 * Read-only throughout — the account *actions* moved to the settings page, and `hasPassword` went
 * with them (see `AccountSettingsViewModel`).
 */
export interface ProfileViewModel {
    user: UserViewModel;
    createdAt: string;
    totalItems: number;
    totalCollections: number;
    itemTypeCounts: ItemTypeCountViewModel[];
}

/**
 * The settings page's account section: which of the two password bodies to render, and what the
 * delete confirmation needs to state before it destroys anything.
 *
 * `hasPassword` is deliberately a boolean rather than the hash it derives from. The page needs to
 * know only whether a password exists — a credentials account can change one, a GitHub-only account
 * has none to change — and the hash itself must never leave the server boundary.
 *
 * The two totals are here because the delete dialog names them ("42 items and 3 collections will be
 * deleted"), not because settings reports usage; that stayed on the profile page.
 */
export interface AccountSettingsViewModel {
    email: string;
    hasPassword: boolean;
    /**
     * Whether a subscription stands in the way of deleting this account — the question the delete
     * dialog actually asks. **Not** "is this account Pro": a subscriber who has cancelled keeps Pro
     * until the period ends and can delete their account throughout, since no further charge is
     * coming. Conflating the two locks that user in a loop that tells them to do what they have
     * already done.
     *
     * Local state is enough to *draw* the choice; `hasBillableSubscription` asks Stripe and is the
     * control.
     */
    subscriptionBlocksDeletion: boolean;
    totalItems: number;
    totalCollections: number;
}

/**
 * A collection as the command palette lists one: its name, and how many items are in it.
 *
 * Deliberately not `CollectionViewModel`. That model derives a dominant type and a contained-type
 * strip, which costs a join over every item in every collection — work the palette renders none of,
 * on a query that runs for every dashboard page view. The count here comes from `_count`.
 */
export interface SearchCollectionViewModel {
    id: string;
    name: string;
    itemCount: number;
}

/**
 * Everything the command palette searches, fetched once per dashboard render and matched entirely in
 * the browser.
 *
 * Items are full summaries rather than a reduced search shape because selecting one opens
 * `ItemDrawer`, which takes an `ItemSummaryViewModel` — a narrower row would have to be re-fetched
 * before the drawer could open on it. No item bodies: matching is on titles, descriptions, and tags
 * (`project-overview.md` §5).
 */
export interface SearchDataViewModel {
    items: ItemSummaryViewModel[];
    collections: SearchCollectionViewModel[];
}

/**
 * Where a paginated listing currently is, and how far it goes.
 *
 * `totalCount` is the size of the whole result set, not of the page — it is what the header counts
 * ("42 items") and what `pageCount` was derived from, and a paginated query no longer has the full
 * set in hand to count it from. `page` is the *clamped* page: a request for a page past the end is
 * answered with the last one, so this never describes a window the query did not actually read.
 */
export interface PaginationViewModel {
    page: number;
    pageCount: number;
    totalCount: number;
    perPage: number;
}

/**
 * An item-type page, which has two shapes rather than one.
 *
 * A Pro-gated type opened by an account without Pro is not a missing page and not an empty one — it
 * is a page about a feature, so it carries the type and nothing else. A union rather than an
 * `items: []` with a `locked` flag beside it, because the alternative is a `pagination` describing a
 * query that was never run: the locked arm reads no items and counts none, and saying "0 items"
 * would be a claim about this account's data rather than about its plan. The compiler enforces the
 * difference at the one place that renders it.
 */
export type ItemTypePageViewModel =
    | {
          locked: false;
          itemType: ItemTypeViewModel;
          items: ItemSummaryViewModel[];
          pagination: PaginationViewModel;
      }
    | {
          locked: true;
          itemType: ItemTypeViewModel;
      };

/** The collections grid: one page of cards, and where that page sits. */
export interface CollectionsPageViewModel {
    collections: CollectionViewModel[];
    pagination: PaginationViewModel;
}

export interface CollectionPageViewModel {
    collection: CollectionViewModel;
    items: ItemSummaryViewModel[];
    pagination: PaginationViewModel;
    /**
     * How the collection's items divide by type, most numerous first. `collection.itemTypes` says
     * only *which* types are in there; this says how many of each, which is what the page's
     * breakdown renders. Types with no items in the collection are absent rather than zero — unlike
     * the sidebar and profile lists, which show every accessible type precisely so a zero is
     * visible.
     */
    itemTypeCounts: ItemTypeCountViewModel[];
}

/**
 * The settings page's billing panel, prepared at the server boundary from the columns the webhook
 * keeps in step with Stripe — so rendering it costs no Stripe round trip.
 */
export interface BillingViewModel {
    isPro: boolean;
    /** `null` on a free account, or when the stored price matches neither configured Price id. */
    cycle: BillingCycle | null;
    /** ISO string, like every other date here, or `null` on a free account. */
    currentPeriodEnd: string | null;
    /**
     * Whether `currentPeriodEnd` is an expiry rather than a renewal. The portal cancels at period
     * end by default, so a cancelled subscription stays entitling — and keeps a date — until it runs
     * out; without this the panel would promise a renewal to someone who has already left.
     */
    cancelAtPeriodEnd: boolean;
    /** Whether a Stripe customer exists — the portal button has nothing to open without one. */
    hasCustomer: boolean;
}
