import {
    Code,
    Image as ImageIcon,
    Link,
    Paperclip,
    Sparkles,
    StickyNote,
    Terminal,
    type LucideProps,
} from "lucide-react";

import type { IconName } from "@/types/item-type";

/**
 * Maps an item type's stored `icon` name to its lucide-react component.
 *
 * The persistence layer keeps `ItemType.icon` as one of a fixed set of strings ({@link IconName});
 * this is where that string becomes a rendered glyph, used wherever an item or a type is shown —
 * rows, cards, the sidebar nav, the type picker. `LucideProps` pass straight through, so callers
 * size and colour the icon as usual.
 *
 * @remarks
 * The `switch` is exhaustive over {@link IconName}: an unhandled name reaches {@link assertNever}
 * and throws, which turns an unsupported icon into a build-time type error rather than a blank
 * space at runtime.
 */

/** Compile-time exhaustiveness guard for the icon `switch`; throws if reached at runtime. */
function assertNever(value: never): never {
    throw new Error(`Unsupported icon name: ${value}`);
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
        /* The file type's glyph. lucide's `File` and `StickyNote` are both a rounded rectangle
           with a folded corner, indistinguishable at the 16px the sidebar and rows draw them at;
           a paperclip cannot be read as Notes or Images, and an attachment is what the type holds. */
        case "Paperclip":
            return <Paperclip {...props} />;
        case "Image":
            return <ImageIcon {...props} />;
        case "Link":
            return <Link {...props} />;
        default:
            return assertNever(name);
    }
}
