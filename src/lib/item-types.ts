import {
    Code,
    File,
    Image,
    Link,
    Sparkles,
    StickyNote,
    Terminal,
    type LucideIcon,
} from "lucide-react";

import { SYSTEM_ITEM_TYPES } from "@/config/item-types";
import type { IconName, ItemType } from "@/types/item";

const typeById = new Map(SYSTEM_ITEM_TYPES.map((type) => [type.id, type]));

/** Look up a system item type by id. */
export function getType(id: string): ItemType | undefined {
    return typeById.get(id);
}

/**
 * Resolves the stringly-typed icon name stored on an item type to its
 * lucide-react component. The `IconName` union keeps this map exhaustive, so a
 * new type can't reference an icon that isn't registered here.
 */
export const ICON_COMPONENTS: Record<IconName, LucideIcon> = {
    Code,
    Sparkles,
    Terminal,
    StickyNote,
    File,
    Image,
    Link,
};
