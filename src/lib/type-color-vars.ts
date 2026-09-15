import type { CSSProperties } from "react";

import { ITEM_TYPE_COLORS } from "@/config/item-type-catalog";

/**
 * The item-type palette exposed as CSS custom properties.
 *
 * The marketing shell in `app/(marketing)/layout.tsx` spreads {@link TYPE_COLOR_VARS} onto its
 * wrapper so landing-page sections can paint with a type's colour — `var(--type-image)` — in place
 * of a literal hex value.
 */

/**
 * The {@link ITEM_TYPE_COLORS} entries keyed as `--type-<name>` custom properties, ready to spread
 * onto a `style` prop.
 *
 * @remarks
 * These are runtime values, so Tailwind cannot generate utility classes for them; a component that
 * needs one reads the variable, and resolves it only beneath an element that spreads this object.
 */
export const TYPE_COLOR_VARS = Object.fromEntries(
    Object.entries(ITEM_TYPE_COLORS).map(([name, color]) => [`--type-${name}`, color]),
) as CSSProperties;
