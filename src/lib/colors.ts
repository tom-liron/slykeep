/**
 * Append an 8-bit hex alpha suffix to a `#rrggbb` color.
 *
 * Used for tinted icon badges, e.g. `withAlpha("#3b82f6")` → `"#3b82f61a"`
 * (~10% opacity). Defaults to `"1a"`.
 */
export function withAlpha(hex: string, alpha = "1a"): string {
    return `${hex}${alpha}`;
}
