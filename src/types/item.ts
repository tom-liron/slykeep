/**
 * Core domain shapes for DevStash.
 *
 * These mirror the eventual Prisma models (see context/project-overview.md) but
 * are kept flat and display-oriented while the app runs on mock data. Data lives
 * in @/lib/mock-data; static type metadata lives in @/config/item-types.
 */

export type ContentKind = "text" | "url" | "file";

/** Names of the lucide-react icons an item type can use. */
export type IconName = "Code" | "Sparkles" | "Terminal" | "StickyNote" | "File" | "Image" | "Link";

export interface ItemType {
    id: string;
    name: string;
    icon: IconName;
    /** hex color */
    color: string;
    /** `/items/[slug]` route segment */
    slug: string;
    kind: ContentKind;
    isPro: boolean;
}

export interface Collection {
    id: string;
    name: string;
    description: string;
    isFavorite: boolean;
    /** ids of the item types this collection holds, dominant first (drives the accent color) */
    typeIds: string[];
}

export interface Item {
    id: string;
    title: string;
    description: string;
    typeId: string;
    /**
     * Display content: text body, link url, or file name depending on the
     * type's kind. The DB splits these into separate columns (content / url /
     * fileName) — this single field is a mock-only convenience.
     */
    content: string;
    tags: string[];
    isFavorite: boolean;
    isPinned: boolean;
    /** ids of the collections this item belongs to */
    collectionIds: string[];
    updatedAt: string;
}

export interface User {
    id: string;
    name: string;
    email: string;
    image: string | null;
    isPro: boolean;
}
