import type {
    EditorFontSize,
    EditorPreferences,
    EditorTabSize,
    EditorThemeId,
    EditorThemePresentation,
} from "@/types/editor";

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
 * The surface both editors paint on, under the app's own theme.
 *
 * A literal hex rather than a Tailwind class, because monaco's theme cannot read a CSS variable — it
 * paints into its own DOM — and a class on the wrapper would silently drift from the theme's copy.
 * `#171717` is what `--card` resolves to in dark mode, so an editor sits on the same surface as
 * every other panel in the app.
 *
 * Since editor themes became a preference this is no longer the only surface — it is
 * `devstash-dark`'s, and the frame reads whichever the active theme declares in the catalog below.
 */
export const EDITOR_SURFACE = "#171717";

/**
 * The themes the editor dropdown offers.
 *
 * Two of them monaco ships (`vs-dark`, `hc-black`) and three `CodeEditor` registers on top of
 * `vs-dark` with `inherit: true` — see the definitions there. Monokai and GitHub Dark are the two
 * the feature was specified with, and they are worth the lines precisely because inheriting means
 * they are a dozen colours each rather than a token table per language.
 *
 * All dark. Monaco's two light themes (`vs`, `hc-light`) are left out rather than forgotten — the
 * app itself is dark-only until the light-mode toggle lands (see project-overview.md §10, Phase 1),
 * and a white editor body inside a dark drawer whose header text is `--muted-foreground` would
 * render unreadable copy over its own frame. They become a two-line addition here the day there is
 * a theme to switch with them.
 *
 * Every entry carries its `editor.background`, because both editors paint their own frame outside
 * monaco and there is no way to ask the library what it is about to use — least of all before it
 * has loaded.
 */
export const EDITOR_THEME_CATALOG: Record<EditorThemeId, EditorThemePresentation> = {
    "devstash-dark": { label: "DevStash Dark", surface: EDITOR_SURFACE },
    monokai: { label: "Monokai", surface: "#272822" },
    "github-dark": { label: "GitHub Dark", surface: "#0d1117" },
    "vs-dark": { label: "VS Dark", surface: "#1e1e1e" },
    "hc-black": { label: "High Contrast", surface: "#000000" },
};

/**
 * The theme ids, derived from the catalog rather than written out beside it, so a theme cannot be
 * offered by one and unknown to the other. This is what the Zod contract validates against and what
 * the dropdown maps over; insertion order above is the order shown.
 */
export const EDITOR_THEME_IDS = Object.keys(EDITOR_THEME_CATALOG) as EditorThemeId[];

/**
 * The dropdown option lists, in the order they are offered.
 *
 * Font sizes stop at 18 and tab sizes at 8 because the editor lives in a ~576px drawer: past those,
 * a line of code is a handful of words and the preference stops being one. `satisfies` rather than a
 * type annotation so each array keeps its literal member types — the dropdowns map over these, and a
 * widened `number[]` would not type-check against the preference it sets.
 */
export const EDITOR_FONT_SIZES = [12, 13, 14, 16, 18] as const satisfies readonly EditorFontSize[];
export const EDITOR_TAB_SIZES = [2, 4, 8] as const satisfies readonly EditorTabSize[];

/**
 * What an account that has never opened the settings panel gets, and the fallback for any stored
 * value that no longer parses.
 *
 * These are the literals both editors carried inline before the preference existed, so an untouched
 * account renders exactly what it rendered before the column was added — the migration adds a null
 * column and changes nothing on screen.
 */
export const DEFAULT_EDITOR_PREFERENCES: EditorPreferences = {
    fontSize: 13,
    tabSize: 2,
    wordWrap: true,
    minimap: false,
    theme: "devstash-dark",
};

/**
 * The editor grows with its content between these two.
 *
 * The floor is about two lines, so a one-line command is not a mostly-empty box; the ceiling is
 * where the editor scrolls itself rather than pushing the rest of the drawer off screen. Past that
 * ceiling is exactly when `app-scrollbar` matters — see `globals.css`, which repaints the native
 * scrollbar in monaco's colours so the two editors do not sit in one drawer with different
 * furniture.
 */
export const EDITOR_MIN_HEIGHT = 76;
export const EDITOR_MAX_HEIGHT = 400;
