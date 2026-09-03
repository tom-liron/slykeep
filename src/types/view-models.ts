import type { BillingCycle } from "@/config/marketing";

import type { ContentType, IconName, ItemTypeName } from "./item-type";

/**
 * The presentation contracts of the whole application: every shape a page or component is allowed
 * to render from.
 *
 * Nothing outside `server/` sees a Prisma record. The query modules read the database and hand their
 * results to the builders in `server/view-models.ts`, which produce these types — nullable columns
 * normalized into display-safe values, `DateTime` serialized to ISO strings, and the persisted half
 * of an item type joined with its configured presentation. Pages and client components depend on
 * this file instead of on the persistence layer, which is why a schema change does not reach the UI
 * and why these models can be serialized across the server/client boundary.
 *
 * The models are many and narrow rather than few and wide, because each one is also the definition
 * of what its query reads: list models carry no item bodies, and the search and sidebar models exist
 * so the queries behind them stay cheap enough to run on every dashboard render. A new surface
 * usually adds a model here and a builder beside it.
 *
 * @see `server/view-models.ts`, which is the only place these are constructed.
 */

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
 * Item data prepared for cards and lists.
 *
 * @remarks
 * The file pair and `createdAt` are here rather than only on the detail model because the file
 * listing describes an item by its object — name, size and upload date — before anything has been
 * opened. They are three small scalars, not a body: list queries still never read `content`, `url`
 * or `fileKey`. Every non-FILE item carries the empty values.
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
     *
     * @remarks
     * `Item` carries a second timestamp, `updatedAt`, which Prisma stamps automatically on every
     * write to the row — a favourite or a pin toggle included. That makes it an answer to "when was
     * this row last written" rather than "when did the content change", so nothing user-facing reads
     * it. `editedAt` is set by hand on the two paths that change content, `createItem` and
     * `updateItem`, which is what makes it safe to sort a recency listing by.
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
 * It extends the summary because the drawer opens over the card it was clicked on and shows the same
 * title, tags and type alongside the body. The body is what makes this type separate at all: list
 * queries never select `content` or `url`, so this is the only item model that carries one.
 *
 * `content` and `url` are both declared because `itemType.contentType` decides which holds the body;
 * the other is empty.
 *
 * @remarks
 * A FILE item's R2 key is absent from every view model. The drawer reads the object from
 * `/api/files/<item id>`, which resolves the key itself from a row it has already authorized, so
 * sending one to the browser would only invite it back as input.
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
 * @remarks
 * The id is what the membership editor needs. A name is enough to show where an item lives, but it
 * is not what `ItemCollection` points at.
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

/** The signed-in account, as the sidebar, the account menu and the profile page render it. */
export interface UserViewModel {
    id: string;
    name: string;
    email: string;
    image: string | null;
    isPro: boolean;
}

/**
 * The dashboard's collection half and item half, prepared as two independent models by two server
 * query modules, so either can change without touching the other's wiring on the page.
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
 *
 * Shared by the sidebar nav, the profile page's type breakdown and a collection page's breakdown,
 * which ask the same question of different scopes. What the count is *over* belongs to the caller:
 * the first two count everything the user owns, the collection page counts only what is in that
 * collection.
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

/** One collection as a sidebar navigation entry. */
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
 * @remarks
 * Close to {@link SidebarCollectionViewModel} but answering a different question. That one is a
 * navigation entry: it needs `isFavorite` because the sidebar splits favourites from recents, and it
 * shows no date. Here every row is a favourite by definition, so the flag would be a constant, and
 * the row does show a date. Narrower than {@link CollectionViewModel}, which additionally derives
 * the contained-type strip only a card renders.
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
 * Read-only throughout. The account actions and the `hasPassword` flag they need belong to the
 * settings page — see {@link AccountSettingsViewModel}.
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
 * delete confirmation has to state before it destroys anything.
 *
 * The two totals are here because the delete dialog names them ("42 items and 3 collections will be
 * deleted"), not because settings reports usage; that stays on the profile page.
 *
 * @remarks
 * `hasPassword` is a boolean rather than the hash it derives from. The page needs to know only
 * whether a password exists — a credentials account can change one, a GitHub-only account has none
 * to change — and the hash must never leave the server boundary.
 */
export interface AccountSettingsViewModel {
    email: string;
    hasPassword: boolean;
    /**
     * Whether a subscription stands in the way of deleting this account: true only while a further
     * charge is still coming.
     *
     * @remarks
     * A narrower question than "is this account Pro", and the two must not be conflated. Someone who
     * cancels through the Stripe portal keeps Pro until the period they paid for runs out, so they
     * are `isPro: true` with nothing left to bill — and their account is perfectly deletable.
     * Branching on `isPro` instead traps that person in a loop telling them to cancel what they have
     * already cancelled.
     *
     * This flag is derived from local columns and is enough to *draw* the choice.
     * `hasBillableSubscription` in `server/billing.ts` asks Stripe and is the control.
     */
    subscriptionBlocksDeletion: boolean;
    totalItems: number;
    totalCollections: number;
}

/**
 * A collection as the command palette lists one: its name, and how many items are in it.
 *
 * @remarks
 * A separate model from {@link CollectionViewModel}, which the collection cards use, because the
 * palette needs far less: that one derives a dominant type and a contained-type strip, which costs a
 * join over every item in every collection, and the palette renders neither — on a query that runs
 * for every dashboard page view. The count here comes from `_count` instead.
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
 * @remarks
 * Items are full summaries rather than a reduced search shape because selecting one opens
 * `ItemDrawer`, which takes an {@link ItemSummaryViewModel}; a narrower row would have to be
 * re-fetched before the drawer could open on it. No item bodies: matching is on titles, descriptions
 * and tags.
 */
export interface SearchDataViewModel {
    items: ItemSummaryViewModel[];
    collections: SearchCollectionViewModel[];
}

/**
 * Where a paginated listing currently is, and how far it goes.
 *
 * `totalCount` is the size of the whole result set rather than of the page — it is what a listing
 * header counts ("42 items") and what `pageCount` derives from, neither of which a paginated query
 * still has the rows to compute. `page` is the *clamped* page: a request past the end is answered
 * with the last one, so this never describes a window the query did not read.
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
 * A Pro-gated type opened by an account without Pro is neither a missing page nor an empty one — it
 * is a page about a feature, so the locked arm carries the type and nothing else.
 *
 * @remarks
 * A union rather than an `items: []` with a `locked` flag beside it: the locked arm reads no items
 * and counts none, so a `pagination` there would describe a query that never ran, and "0 items"
 * would be a claim about this account's data rather than about its plan. The compiler enforces the
 * difference at the one page that renders it.
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

/** One collection's page: the collection itself, a page of its items, and its type breakdown. */
export interface CollectionPageViewModel {
    collection: CollectionViewModel;
    items: ItemSummaryViewModel[];
    pagination: PaginationViewModel;
    /**
     * How the collection's items divide by type, most numerous first. `collection.itemTypes` says
     * only *which* types are in there; this says how many of each, which is what the page's
     * breakdown renders.
     *
     * @remarks
     * Types with no items in the collection are absent rather than zero — unlike the sidebar and
     * profile lists, which show every accessible type so that a zero is visible.
     */
    itemTypeCounts: ItemTypeCountViewModel[];
}

/**
 * The settings page's billing panel, prepared from the columns the Stripe webhook keeps in step, so
 * rendering it costs no Stripe round trip.
 */
export interface BillingViewModel {
    isPro: boolean;
    /** `null` on a free account, or when the stored price matches neither configured Price id. */
    cycle: BillingCycle | null;
    /** ISO string, like every other date here, or `null` on a free account. */
    currentPeriodEnd: string | null;
    /**
     * Whether `currentPeriodEnd` is an expiry rather than a renewal.
     *
     * @remarks
     * The portal cancels at period end by default, so a cancelled subscription stays entitling — and
     * keeps a date — until it runs out. Without this the panel would promise a renewal to someone
     * who has already left.
     */
    cancelAtPeriodEnd: boolean;
    /** Whether a Stripe customer exists — the portal button has nothing to open without one. */
    hasCustomer: boolean;
}
