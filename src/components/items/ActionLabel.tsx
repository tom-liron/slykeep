/**
 * A toolbar button's word in the item drawer's action row, shown only when the drawer is a panel
 * beside the page rather than the page itself — 680px, which is *not* the 600px stop `ItemDrawer` uses to turn
 * the drawer from a page into a panel, and it has to stay identical to the one on the tray, because the tray
 * is an equal-column grid below it and labelled buttons cannot go in a grid with no line to wrap on.
 *
 * One stop, because there is only one question. Above 600 the panel is pinned at `min(92vw, 36rem)`,
 * so the row inside it is the same width at 600px and at 4K — which means the words either always
 * fit or never do, and no breakpoint can change that. The rows are not all the same width — a snippet's
 * five controls measure 377px, an image's 406px (`Download` replaces `Copy`), a previewable text file's 481px
 * (`showsCopy` gives it both, but only under the preview size cap and only for an extension the
 * language map knows — otherwise it is five like an image) — and the panel is sized to the widest, not the common one, inside a 525px tray. Below 600 the drawer is the whole screen and the row is icons in
 * equal columns, which cannot wrap either. There is no third case.
 *
 * Four stops (440, 480, 530, 560) and a container query were tried before it was clear that the
 * breakpoint was never the variable. The panel's *cap* is: at 30rem the tray was 418px against 377,
 * 11% of slack, less than the spread between font stacks — so on a machine rendering slightly wider
 * than this one the row wrapped at every width, and moving the stop moved nothing. Widening the cap
 * is what fixed it.
 *
 * `flex-wrap` stays as the last resort. The previewable-text-file row at 481px has 44px of slack in a
 * 525px tray, the least of any item type and also the rarest, so it is the one that would go first on a machine
 * rendering wider than this. Two lines is the wrong look, but it beats the Delete button being
 * clipped off the edge by the sheet's `overflow-x-hidden`, which is what `flex-nowrap` would do.
 *
 * Every button in that row pairs this with its own `aria-label` and `title`, so what disappears at
 * narrow widths is only the visible word: the accessible name and the hover tooltip both survive.
 * That pairing is the contract — a control in this row that has the label but not the two attributes
 * loses its tooltip when the word goes, and one that has neither is simply a different kind of
 * button sitting in a row of identical ones.
 *
 * It lives in its own module rather than beside the row it belongs to because the row's controls do
 * not all live in one file: `DeleteItemDialog` owns its own trigger. While this was local to
 * `ItemDrawer`, that trigger could not reach it and was icon-only at every width, with no `title`
 * either — so on a wide screen four buttons read "Favorite Pin Copy Edit" and the fifth was a bare
 * glyph that said nothing on hover. Importing it back out of `ItemDrawer` would be a cycle, since
 * `ItemDrawer` imports the dialog.
 */
export function ActionLabel({ children }: { children: string }) {
    return <span className="hidden min-[42.5rem]:inline">{children}</span>;
}
