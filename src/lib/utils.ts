import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Class-name helpers shared by every styled component.
 *
 * {@link cn} is the class-merging utility the shadcn/ui primitives and the feature components are
 * written against. {@link withAlpha} turns a stored item-type hex colour into a translucent fill for
 * the coloured accents on cards and rows.
 */

/**
 * Merges class-name values and resolves Tailwind conflicts, so a caller's override wins over a
 * component default without either being ordered by hand.
 *
 * `clsx` flattens the array, object and conditional forms; `tailwind-merge` collapses a conflicting
 * pair such as `px-2 px-4` to the last one written.
 */
export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

/**
 * Appends an alpha channel to a 6-digit hex colour, e.g. "#5b9dff" → "#5b9dff38".
 *
 * The item-type palette in `config/item-type-catalog.ts` is opaque hex; the type-coloured icon
 * tiles on the stat band, cards, rows, drawer header and profile render it as a tint behind the
 * full-strength icon. `opacity` is clamped to 0–1.
 *
 * @defaultValue `opacity` is 0.22
 */
export function withAlpha(hexColor: string, opacity = 0.22): string {
    const clamped = Math.max(0, Math.min(1, opacity));
    const alpha = Math.round(clamped * 255)
        .toString(16)
        .padStart(2, "0");
    return `${hexColor}${alpha}`;
}
