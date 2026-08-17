import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * A selectable chip backed by a real radio or checkbox.
 *
 * The input is `sr-only` rather than absent: the control has to stay a native form control so it
 * keeps its role, its checked state, and arrow-key behaviour within a `name` group. The `<label>`
 * wrapping it is what gets painted, and `has-[:focus-visible]:` is what moves the focus ring from
 * the invisible input onto that painted box.
 *
 * `pointer-coarse:min-h-11` is the same 44px floor `ui/button.tsx` documents, and it is why this
 * component exists — the two chip pickers that predate it were near-identical copies, and both had
 * missed it. `min-h-11` rather than `py-3`, which lands at 42px and misses the number the policy is
 * stated in; the box grows rather than taking `ui/switch.tsx`'s invisible `::after` overhang,
 * because chips sit on `gap-2` and overhang there would overlap the neighbour a tap was aimed at.
 *
 * Selected styling is the caller's: one picker tints itself with the item type's colour, which is
 * user-facing data and can only arrive as an inline `style`, and the other uses theme tokens. So
 * this owns the skeleton and the unselected state, and takes `className`/`style` on top. The base
 * keeps `border-border` in both states rather than dropping the colour when checked — `cn` merges a
 * caller's `border-*` over it, and an uncoloured `border` would otherwise fall back to
 * `currentColor` for any future caller that tints neither.
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
                "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
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
