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
