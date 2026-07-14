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

import { ITEM_TYPE_CATALOG, SYSTEM_ITEM_TYPE_NAMES } from "@/config/item-type-catalog";
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
        for (const name of SYSTEM_ITEM_TYPE_NAMES) {
            const { icon } = ITEM_TYPE_CATALOG[name];
            expect(TypeIcon({ name: icon }).type).toBe(iconComponents[icon]);
        }
    });
});
