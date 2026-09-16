import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * A selectable chip backed by a real radio or checkbox — the shared control behind the item forms'
 * type picker and collection picker.
 *
 * The input stays a native form control (kept `sr-only`, not removed) so it keeps its role,
 * checked state, and arrow-key behaviour within a `name` group. The `<label>` around it is what
 * gets painted, and `focus-glow-within` moves the focus indicator from the input onto that box.
 *
 * Selected styling is the caller's: the type picker tints with the item type's colour, which is
 * user data and can only arrive as an inline `style`; the collection picker uses theme tokens.
 * This component owns the skeleton and the unselected state and takes `className`/`style` on top.
 *
 * @remarks
 * `pointer-coarse:min-h-11` is the 44px touch-target floor from `ui/button.tsx`. It uses `min-h-11`
 * because `py-3` lands at 42px, and it grows the box rather than taking `ui/switch.tsx`'s `::after`
 * overhang, because chips sit on `gap-2` where an overhang would overlap the neighbouring chip.
 *
 * The base keeps `border-border` in both checked states. `cn` merges a caller's `border-*` over
 * it; a bare `border` with no colour would fall back to `currentColor` for a caller that tints
 * neither state.
 */
export function ToggleChip({
    type,
    name,
    value,
    checked,
    onChange,
    className,
    style,
    children,
}: {
    type: "radio" | "checkbox";
    name: string;
    value: string;
    checked: boolean;
    onChange: () => void;
    className?: string;
    style?: CSSProperties;
    children: ReactNode;
}) {
    return (
        <label
            className={cn(
                "flex max-w-full cursor-pointer items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium transition-colors pointer-coarse:min-h-11",
                "focus-glow-within",
                checked ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                className,
            )}
            style={style}
        >
            <input
                type={type}
                name={name}
                value={value}
                checked={checked}
                onChange={onChange}
                className="sr-only"
            />
            {children}
        </label>
    );
}
