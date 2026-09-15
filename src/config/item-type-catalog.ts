import type { IconName, ItemTypeName, ItemTypePresentation } from "@/types/item-type";

/**
 * The application half of an item type: everything about a type that the database does not persist.
 *
 * An `ItemType` row holds only `{ id, name, icon, color, isSystem, userId }`. A type's plural label,
 * its route slug, the content type its items store and whether it is Pro-gated are configuration and
 * live here in {@link ITEM_TYPE_CATALOG}, keyed by that persisted `name`. The two halves are joined
 * at the server boundary by
 * `server/view-models.ts`; `prisma/seed.ts` writes the rows from this catalog, `lib/item-schemas.ts`
 * derives each type's write contract from it, and `server/items.ts` resolves a URL slug back to a
 * type name.
 *
 * Adding a built-in type, or changing one's colour, icon, route or Pro gating, starts here.
 */

/**
 * The item-type palette. Used by {@link ITEM_TYPE_CATALOG}, and by the surfaces designed out of the same
 * colours — the dashboard's stat cards, and `lib/type-color-vars.ts`, which hands the palette to the
 * landing page and `/upgrade` as CSS variables.
 */
export const ITEM_TYPE_COLORS = {
    snippet: "#FF5C5C",
    prompt: "#FF8F40",
    command: "#3DD68C",
    note: "#F266B3",
    file: "#5B9DFF",
    image: "#A987FF",
    link: "#2FD0E6",
} as const;

/**
 * Presentation and gating for each built-in type, keyed by its persisted natural name.
 *
 * @remarks
 * Item-type ids are assigned by the database and are absent here. Resolve a type by name — or by
 * slug, for routes — and join it to its persisted row.
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

/**
 * Display order for the sidebar's type list, and the order the seed writes the rows in. Also the
 * membership test behind {@link isItemTypeName}.
 */
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

/**
 * Narrows the persisted `ItemType.icon`, which the database stores as an unconstrained string, to
 * the set every entry of {@link ITEM_TYPE_CATALOG} draws from.
 */
export function isIconName(value: string): value is IconName {
    return (ICON_NAMES as readonly string[]).includes(value);
}

/**
 * Narrows the persisted `ItemType.name` the same way.
 *
 * @remarks
 * A user's custom type is not in {@link ITEM_TYPE_CATALOG}, so this is what separates a built-in
 * type from one whose presentation cannot be resolved here.
 */
export function isItemTypeName(value: string): value is ItemTypeName {
    return (SYSTEM_ITEM_TYPE_NAMES as readonly string[]).includes(value);
}

/**
 * Resolves a route slug back to a type name, for the `/items/[slug]` pages: the URL says
 * "snippets", the database row says "snippet".
 */
export function getItemTypeNameBySlug(slug: string): ItemTypeName | undefined {
    return itemTypeNameBySlug.get(slug);
}
