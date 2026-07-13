import {
    Code,
    File,
    Image as ImageIcon,
    Link,
    Sparkles,
    StickyNote,
    Terminal,
    type LucideIcon,
} from "lucide-react";
import { describe, expect, it } from "vitest";

import { SYSTEM_ITEM_TYPE_CATALOG } from "@/config/item-type-catalog";
import type { IconName } from "@/types/item-type";
import { TypeIcon } from "./TypeIcon";

const iconComponents: Record<IconName, LucideIcon> = {
    Code,
    Sparkles,
    Terminal,
    StickyNote,
    File,
    Image: ImageIcon,
    Link,
};

describe("TypeIcon", () => {
    it("maps every configured icon name to its Lucide component", () => {
        for (const itemType of SYSTEM_ITEM_TYPE_CATALOG) {
            expect(TypeIcon({ name: itemType.icon }).type).toBe(iconComponents[itemType.icon]);
        }
    });
});
