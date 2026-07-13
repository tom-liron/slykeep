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
        case "File":
            return <File {...props} />;
        case "Image":
            return <ImageIcon {...props} />;
        case "Link":
            return <Link {...props} />;
        default:
            return assertNever(name);
    }
}
