/**
 * The visible word inside a toolbar button in the item drawer's action row.
 *
 * Hidden below 680px, where the row collapses to icons only; shown from there up.
 *
 * @remarks
 * Keep the `min-[42.5rem]` breakpoint synchronized with the grid → flex switch in
 * `ItemDrawerToolbar`: labels appear at the same width the row stops being an unwrappable grid.
 * Every button in the row also carries its own `aria-label` and `title`, so only the visible word
 * disappears at narrow widths.
 *
 * Its own module because `DeleteItemDialog` (which `ItemDrawer` imports) also renders a button in
 * the row, so this cannot live in `ItemDrawer`.
 */
export function ActionLabel({ children }: { children: string }) {
    return <span className="hidden min-[42.5rem]:inline">{children}</span>;
}
