/**
 * The values the two content editors have to agree on.
 *
 * `CodeEditor` and `MarkdownEditor` are the app's two content surfaces — an item opens in one or the
 * other depending only on whether its type's content is code — so they have to look like a matched
 * pair, and switching an item's type must not change how much of the drawer its body takes. They
 * used to hold their own copies of these three values, kept in step by comments in each file saying
 * the other one had the same number. That is a convention, not a constraint; this is the constraint.
 *
 * It lives in `config/` rather than `lib/` because these are static presentation values, not
 * behaviour — the same reason `item-type-catalog.ts` is there.
 */

/**
 * The surface both editors paint on.
 *
 * A literal hex rather than a Tailwind class, because monaco's theme cannot read a CSS variable — it
 * paints into its own DOM — and a class on the wrapper would silently drift from the theme's copy.
 * `#171717` is what `--card` resolves to in dark mode, so an editor sits on the same surface as
 * every other panel in the app.
 */
export const EDITOR_SURFACE = "#171717";

/**
 * The editor grows with its content between these two.
 *
 * The floor is about two lines, so a one-line command is not a mostly-empty box; the ceiling is
 * where the editor scrolls itself rather than pushing the rest of the drawer off screen. Past that
 * ceiling is exactly when `editor-scrollbar` matters — see `globals.css`, which repaints the native
 * scrollbar in monaco's colours so the two editors do not sit in one drawer with different
 * furniture.
 */
export const EDITOR_MIN_HEIGHT = 76;
export const EDITOR_MAX_HEIGHT = 400;
