/**
 * The compile-time contracts of the item-type system: the closed sets a type is described by, and
 * the shape of the half of a type the database does not persist.
 *
 * An item type is assembled from two sources. `ItemType` rows persist `{ id, name, icon, color,
 * isSystem, userId }`; everything else a type needs in order to render is configuration in
 * `config/item-type-catalog.ts`, which satisfies {@link ItemTypePresentation} and is keyed by the
 * persisted `name`. `toItemTypeViewModel` in `server/view-models.ts` joins the two at the server
 * boundary and validates the persisted `icon` string against {@link IconName} there, since a text
 * column carries no guarantee. `TypeIcon` then maps that name to a lucide component, and
 * `lib/item-schemas.ts` builds its per-type write contracts from {@link ItemTypeName}.
 *
 * Adding an item type starts here and continues in the catalog.
 */

/** Mirrors the persisted `ContentType` enum; discriminates which item content field is populated. */
export type ContentType = "TEXT" | "URL" | "FILE";

/**
 * The lucide icons an item type may use.
 *
 * A closed union rather than `string`, because the value arrives from a database column: narrowing
 * it at the server boundary is what lets `TypeIcon` index its map without a fallback branch.
 */
export type IconName = "Code" | "Sparkles" | "Terminal" | "StickyNote" | "File" | "Image" | "Link";

/** The persisted natural key of a system item type (`@@unique([name, userId])`). */
export type ItemTypeName = "snippet" | "prompt" | "command" | "note" | "file" | "image" | "link";

/**
 * Item-type data the application owns rather than the database: display label, route slug,
 * content type, and Pro gating. `icon` and `color` are persisted; they are declared here because
 * the catalog is the source the seed writes from.
 */
export interface ItemTypePresentation {
    label: string;
    icon: IconName;
    color: string;
    slug: string;
    contentType: ContentType;
    isPro: boolean;
}
