import type { ItemTypeMetadata } from "@/types/item-type";

export const ITEM_TYPE_COLORS = {
    snippet: "#3b82f6",
    prompt: "#8b5cf6",
    command: "#f97316",
    note: "#fde047",
    file: "#6b7280",
    image: "#ec4899",
    link: "#10b981",
} as const;

export const FALLBACK_TYPE_COLOR = ITEM_TYPE_COLORS.file;

export const SYSTEM_ITEM_TYPE_CATALOG: readonly ItemTypeMetadata[] = [
    {
        id: "type_snippet",
        name: "Snippets",
        icon: "Code",
        color: ITEM_TYPE_COLORS.snippet,
        slug: "snippets",
        kind: "text",
        isPro: false,
    },
    {
        id: "type_prompt",
        name: "Prompts",
        icon: "Sparkles",
        color: ITEM_TYPE_COLORS.prompt,
        slug: "prompts",
        kind: "text",
        isPro: false,
    },
    {
        id: "type_command",
        name: "Commands",
        icon: "Terminal",
        color: ITEM_TYPE_COLORS.command,
        slug: "commands",
        kind: "text",
        isPro: false,
    },
    {
        id: "type_note",
        name: "Notes",
        icon: "StickyNote",
        color: ITEM_TYPE_COLORS.note,
        slug: "notes",
        kind: "text",
        isPro: false,
    },
    {
        id: "type_file",
        name: "Files",
        icon: "File",
        color: ITEM_TYPE_COLORS.file,
        slug: "files",
        kind: "file",
        isPro: true,
    },
    {
        id: "type_image",
        name: "Images",
        icon: "Image",
        color: ITEM_TYPE_COLORS.image,
        slug: "images",
        kind: "file",
        isPro: true,
    },
    {
        id: "type_link",
        name: "Links",
        icon: "Link",
        color: ITEM_TYPE_COLORS.link,
        slug: "links",
        kind: "url",
        isPro: false,
    },
];

export const SYSTEM_ITEM_TYPE_BY_ID: ReadonlyMap<string, ItemTypeMetadata> = new Map(
    SYSTEM_ITEM_TYPE_CATALOG.map((itemType) => [itemType.id, itemType]),
);

const systemItemTypeBySlug = new Map(
    SYSTEM_ITEM_TYPE_CATALOG.map((itemType) => [itemType.slug, itemType]),
);

export function getSystemItemTypeById(id: string): ItemTypeMetadata | undefined {
    return SYSTEM_ITEM_TYPE_BY_ID.get(id);
}

export function getSystemItemTypeBySlug(slug: string): ItemTypeMetadata | undefined {
    return systemItemTypeBySlug.get(slug);
}
