import {
    Code,
    Image as ImageIcon,
    Link,
    Paperclip,
    Sparkles,
    StickyNote,
    Terminal,
    type LucideIcon,
} from "lucide-react";
import { describe, expect, it } from "vitest";

import { ITEM_TYPE_CATALOG, SYSTEM_ITEM_TYPE_NAMES } from "@/config/item-type-catalog";
import type { IconName } from "@/types/item-type";
import { TypeIcon } from "./TypeIcon";

/**
 * Pins the mapping from a persisted icon name to the lucide component `TypeIcon` draws, so every
 * name in the item-type catalog renders its intended glyph.
 */

const iconComponents: Record<IconName, LucideIcon> = {
    Code,
    Sparkles,
    Terminal,
    StickyNote,
    Paperclip,
    Image: ImageIcon,
    Link,
};

describe("TypeIcon", () => {
    it("maps every configured icon name to its Lucide component", () => {
        for (const name of SYSTEM_ITEM_TYPE_NAMES) {
            const { icon } = ITEM_TYPE_CATALOG[name];
            expect(TypeIcon({ name: icon }).type).toBe(iconComponents[icon]);
        }
    });
});
