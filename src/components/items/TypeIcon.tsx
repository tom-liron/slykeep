import {
    Code,
    File,
    Image as ImageIcon,
    Link,
    Sparkles,
    StickyNote,
    Terminal,
    type LucideProps,
} from "lucide-react";

import type { IconName } from "@/types/item-type";

const ICON_NAMES: ReadonlySet<string> = new Set<IconName>([
    "Code",
    "Sparkles",
    "Terminal",
    "StickyNote",
    "File",
    "Image",
    "Link",
]);

/** Converts untrusted persisted icon names into the supported icon union. */
export function resolveIconName(name: string): IconName {
    return ICON_NAMES.has(name) ? (name as IconName) : "File";
}

export function TypeIcon({ name, ...props }: { name: IconName } & LucideProps) {
    switch (name) {
        case "Code":
            return <Code {...props} />;
        case "Sparkles":
            return <Sparkles {...props} />;
        case "Terminal":
            return <Terminal {...props} />;
        case "StickyNote":
            return <StickyNote {...props} />;
        case "Image":
            return <ImageIcon {...props} />;
        case "Link":
            return <Link {...props} />;
        default:
            return <File {...props} />;
    }
}
