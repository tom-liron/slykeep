/** Mirrors the persisted `ContentType` enum; discriminates which item content field is populated. */
export type ContentType = "TEXT" | "URL" | "FILE";

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
