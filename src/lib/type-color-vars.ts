import type { CSSProperties } from "react";

import { ITEM_TYPE_COLORS } from "@/config/item-type-catalog";

/**
 * The item-type palette as custom properties, for the surfaces that are *designed* out of it.
 *
 * These are runtime values from the catalog, so Tailwind cannot generate classes for them — a
 * component that wants the prompt purple has to reach a variable. Declaring them on an ancestor is
 * what lets the markup say `var(--type-prompt)` rather than retyping `#8b5cf6`.
 *
 * Shared rather than declared per layout: the marketing shell established this, and `/upgrade`
 * renders the same pricing cards inside the app shell. Two copies of the derivation would be two
 * places for the palette to drift apart, on the one pair of pages whose whole job is to look like
 * each other.
 */
export const TYPE_COLOR_VARS = Object.fromEntries(
    Object.entries(ITEM_TYPE_COLORS).map(([name, color]) => [`--type-${name}`, color]),
) as CSSProperties;
