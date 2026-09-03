import type { CSSProperties } from "react";

import { ITEM_TYPE_COLORS } from "@/config/item-type-catalog";

/**
 * The item-type palette exposed as CSS custom properties.
 *
 * Two surfaces styled outside the app's normal component palette render the colours directly in
 * their markup: the marketing shell in `app/(marketing)/layout.tsx` and the `/upgrade` page, which
 * shows the same pricing cards inside the app shell. Both spread {@link TYPE_COLOR_VARS} onto a
 * wrapper element so descendants can write `var(--type-prompt)` in place of a literal hex value.
 */

/**
 * The {@link ITEM_TYPE_COLORS} entries keyed as `--type-<name>` custom properties, ready to spread
 * onto a `style` prop.
 *
 * @remarks
 * These are runtime values, so Tailwind cannot generate utility classes for them; a component that
 * needs one reads the variable. One shared derivation keeps the marketing shell and `/upgrade` — the
 * pair of pages whose job is to look identical — from drifting apart.
 */
export const TYPE_COLOR_VARS = Object.fromEntries(
    Object.entries(ITEM_TYPE_COLORS).map(([name, color]) => [`--type-${name}`, color]),
) as CSSProperties;
