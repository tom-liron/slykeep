import type { IconName, ItemTypeName, ItemTypePresentation } from "@/types/item-type";

export const ITEM_TYPE_COLORS = {
    snippet: "#3b82f6",
    prompt: "#8b5cf6",
    command: "#f97316",
    note: "#fde047",
    file: "#6b7280",
    image: "#ec4899",
    link: "#10b981",
} as const;

/**
 * Presentation and gating for the built-in item types, keyed by their persisted natural name.
 * Item-type ids are assigned by the database, so they are deliberately absent here — resolve a
 * type by name (or by slug, for routes) and join it to its persisted row.
 */
export const ITEM_TYPE_CATALOG: Record<ItemTypeName, ItemTypePresentation> = {
    snippet: {
        label: "Snippets",
        icon: "Code",
        color: ITEM_TYPE_COLORS.snippet,
        slug: "snippets",
        contentType: "TEXT",
        isPro: false,
    },
    prompt: {
        label: "Prompts",
        icon: "Sparkles",
        color: ITEM_TYPE_COLORS.prompt,
        slug: "prompts",
        contentType: "TEXT",
        isPro: false,
    },
    command: {
        label: "Commands",
        icon: "Terminal",
        color: ITEM_TYPE_COLORS.command,
        slug: "commands",
        contentType: "TEXT",
        isPro: false,
    },
    note: {
        label: "Notes",
        icon: "StickyNote",
        color: ITEM_TYPE_COLORS.note,
        slug: "notes",
        contentType: "TEXT",
        isPro: false,
    },
    file: {
        label: "Files",
        icon: "File",
        color: ITEM_TYPE_COLORS.file,
        slug: "files",
        contentType: "FILE",
        isPro: true,
    },
    image: {
        label: "Images",
        icon: "Image",
        color: ITEM_TYPE_COLORS.image,
        slug: "images",
        contentType: "FILE",
        isPro: true,
    },
    link: {
        label: "Links",
        icon: "Link",
        color: ITEM_TYPE_COLORS.link,
        slug: "links",
        contentType: "URL",
        isPro: false,
    },
};

/** Display order for the sidebar, and the order the seed writes rows in. */
export const SYSTEM_ITEM_TYPE_NAMES: readonly ItemTypeName[] = [
    "snippet",
    "prompt",
    "command",
    "note",
    "file",
    "image",
    "link",
];

const ICON_NAMES: readonly IconName[] = [
    "Code",
    "Sparkles",
    "Terminal",
    "StickyNote",
    "File",
    "Image",
    "Link",
];

const itemTypeNameBySlug = new Map<string, ItemTypeName>(
    SYSTEM_ITEM_TYPE_NAMES.map((name) => [ITEM_TYPE_CATALOG[name].slug, name]),
);

/** Guards the persisted `ItemType.icon` string, which the database stores untyped. */
export function isIconName(value: string): value is IconName {
    return (ICON_NAMES as readonly string[]).includes(value);
}

export function getItemTypeNameBySlug(slug: string): ItemTypeName | undefined {
    return itemTypeNameBySlug.get(slug);
}
