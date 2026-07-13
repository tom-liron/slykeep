import type { LucideProps } from "lucide-react";

import { ICON_COMPONENTS } from "@/lib/item-types";
import type { IconName } from "@/types/item";

/** Renders the lucide-react icon registered for a (typed) item-type icon name. */
export function TypeIcon({ name, ...props }: { name: IconName } & LucideProps) {
    const Icon = ICON_COMPONENTS[name];
    return <Icon {...props} />;
}
