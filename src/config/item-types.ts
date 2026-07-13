import type { ItemType } from "@/types/item";

/**
 * Single source of truth for the type color palette. Hex values are defined
 * here and nowhere else — the item types below, the stat cards, and any other
 * type-colored UI all read from this object.
 */
export const TYPE_PALETTE = {
    snippet: "#3b82f6",
    prompt: "#8b5cf6",
    command: "#f97316",
    note: "#fde047",
    file: "#6b7280",
    image: "#ec4899",
    link: "#10b981",
} as const;

/** Neutral accent used when a type can't be resolved (matches the file gray). */
export const FALLBACK_TYPE_COLOR: string = TYPE_PALETTE.file;

/**
 * The seven immutable system item types. Source of truth for their names,
 * icons, colors, routes, and content kinds — the sidebar, cards, and eventual
 * DB seed all read from here.
 */
export const SYSTEM_ITEM_TYPES: ItemType[] = [
    {
        id: "type_snippet",
        name: "Snippets",
        icon: "Code",
        color: TYPE_PALETTE.snippet,
        slug: "snippets",
        kind: "text",
        isPro: false,
    },
    {
        id: "type_prompt",
        name: "Prompts",
        icon: "Sparkles",
        color: TYPE_PALETTE.prompt,
        slug: "prompts",
        kind: "text",
        isPro: false,
    },
    {
        id: "type_command",
        name: "Commands",
        icon: "Terminal",
        color: TYPE_PALETTE.command,
        slug: "commands",
        kind: "text",
        isPro: false,
    },
    {
        id: "type_note",
        name: "Notes",
        icon: "StickyNote",
        color: TYPE_PALETTE.note,
        slug: "notes",
        kind: "text",
        isPro: false,
    },
    {
        id: "type_file",
        name: "Files",
        icon: "File",
        color: TYPE_PALETTE.file,
        slug: "files",
        kind: "file",
        isPro: true,
    },
    {
        id: "type_image",
        name: "Images",
        icon: "Image",
        color: TYPE_PALETTE.image,
        slug: "images",
        kind: "file",
        isPro: true,
    },
    {
        id: "type_link",
        name: "Links",
        icon: "Link",
        color: TYPE_PALETTE.link,
        slug: "links",
        kind: "url",
        isPro: false,
    },
];
