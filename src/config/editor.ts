import type {
    EditorFontSize,
    EditorPreferences,
    EditorTabSize,
    EditorThemeId,
    EditorThemePresentation,
} from "@/types/editor";

/**
 * Shared configuration for the item content editors and for the editor-preferences feature.
 *
 * An item's body opens in one of three surfaces — `CodeEditor` (monaco), `MarkdownEditor`, or the
 * `ContentTextarea` fallback used on a touch pointer — chosen only by the item's type. They have to
 * read as one editor, so their sizing, surface colour and theme list are defined here instead of in
 * each component, and switching an item's type cannot change how much of the drawer its body takes.
 *
 * The same values define the preference itself: `EditorPreferencesRows` renders its dropdowns from
 * these arrays ({@link EDITOR_FONT_SIZES}, {@link EDITOR_TAB_SIZES}, {@link EDITOR_THEME_IDS}),
 * `lib/editor-preferences.ts` validates a stored preference against them, and
 * `lib/editor-metrics.ts` computes the rendered height from the bounds. Offering a new theme, font
 * size or tab size is one edit here.
 */

/**
 * The surface {@link EDITOR_THEME_CATALOG}'s `slykeep-dark` entry paints on: what `--field` resolves
 * to, so an editor reads as the same recessed input surface as every form field in the app.
 *
 * @remarks
 * A literal hex rather than a Tailwind class. Monaco paints into its own DOM and its themes cannot
 * read a CSS variable, so this value and `--field` in `globals.css` move together.
 */
export const EDITOR_SURFACE = "#141416";

/**
 * The themes the editor's theme dropdown offers, each with the background it paints.
 *
 * Monaco ships two of them (`vs-dark`, `hc-black`); `CodeEditor` registers the other three on top of
 * `vs-dark` with `inherit: true`.
 *
 * @remarks
 * Every entry carries its own `editor.background` because both editors paint a frame outside monaco,
 * and the library cannot be asked which colour it will use before it has loaded.
 *
 * All five are dark. The application is dark-only until the light-mode toggle ships, and a light
 * editor body inside a dark drawer renders that frame's muted text unreadably.
 */
export const EDITOR_THEME_CATALOG: Record<EditorThemeId, EditorThemePresentation> = {
    "slykeep-dark": { label: "SlyKeep Dark", surface: EDITOR_SURFACE },
    monokai: { label: "Monokai", surface: "#272822" },
    "github-dark": { label: "GitHub Dark", surface: "#0d1117" },
    "vs-dark": { label: "VS Dark", surface: "#1e1e1e" },
    "hc-black": { label: "High Contrast", surface: "#000000" },
};

/**
 * The theme ids, derived from {@link EDITOR_THEME_CATALOG} rather than listed beside it, so the set
 * the dropdown
 * offers and the set `editorPreferencesSchema` in `lib/editor-preferences.ts` accepts cannot
 * diverge. Insertion order above is the order shown.
 */
export const EDITOR_THEME_IDS = Object.keys(EDITOR_THEME_CATALOG) as EditorThemeId[];

/**
 * The font-size and tab-size options, in the order the settings dropdowns offer them.
 *
 * @remarks
 * The editor lives in a drawer around 576px wide, which is what bounds these at 18 and 8: past
 * those, a line of code holds a handful of words and the preference stops being one. `satisfies`
 * rather than a type annotation keeps each member's literal type — a widened `number[]` would not
 * type-check against the preference it sets.
 */
export const EDITOR_FONT_SIZES = [12, 13, 14, 16, 18] as const satisfies readonly EditorFontSize[];
export const EDITOR_TAB_SIZES = [2, 4, 8] as const satisfies readonly EditorTabSize[];

/**
 * What an account that has never opened the settings panel gets, and the fallback for a stored
 * value that no longer parses. Every field names one of the options above, so a default cannot pick
 * a theme {@link EDITOR_THEME_IDS} does not list.
 */
export const DEFAULT_EDITOR_PREFERENCES: EditorPreferences = {
    fontSize: 13,
    tabSize: 2,
    wordWrap: true,
    minimap: false,
    theme: "slykeep-dark",
};

/**
 * The range an editor grows through as its content grows. {@link EDITOR_MAX_HEIGHT_DVH} lowers the
 * ceiling on a short viewport.
 *
 * The floor is about two lines, so a one-line command is not a mostly-empty box. At the ceiling the
 * editor starts scrolling itself rather than pushing the rest of the drawer off screen — which is
 * when `app-scrollbar` in `globals.css` matters, repainting the native scrollbar in monaco's colours
 * so the two editors do not sit in one drawer with different furniture.
 */
export const EDITOR_MIN_HEIGHT = 76;
export const EDITOR_MAX_HEIGHT = 400;

/**
 * {@link EDITOR_MAX_HEIGHT} again as a share of the viewport, for screens shorter than the pixel
 * value.
 *
 * The lower of the two applies, so nothing moves on a desktop or on an upright phone. Only short
 * viewports do — a phone in landscape, where 400px is taller than the visible area and the editor
 * would push its own label and the Save button off screen.
 *
 * @remarks
 * A whole number of `dvh` rather than a `0.6` ratio: `0.6 * 100` is `60.00000000000001` in binary
 * floating point, and that is the number that would reach the stylesheet.
 */
export const EDITOR_MAX_HEIGHT_DVH = 60;

/**
 * The height rule as a CSS length, for the surfaces the stylesheet sizes — the markdown panels and
 * the textarea fallback.
 *
 * @remarks
 * Monaco cannot use it: it has to be given a pixel height or it will not scroll itself, so
 * `editorMaxHeight()` computes the same rule in JavaScript from {@link EDITOR_MAX_HEIGHT} and
 * {@link EDITOR_MAX_HEIGHT_DVH}. The two are one rule written twice and move together.
 * @see `editorMaxHeight` in `lib/editor-metrics.ts`
 */
export const EDITOR_MAX_HEIGHT_CSS = `min(${EDITOR_MAX_HEIGHT}px, ${EDITOR_MAX_HEIGHT_DVH}dvh)`;

/**
 * The size below which iOS Safari zooms the page in on a focused control, and does not zoom back out
 * afterwards.
 *
 * @remarks
 * A floor on what is rendered under a finger, not on what is stored. {@link EDITOR_FONT_SIZES}
 * still offers 12, and 12 stays 12 on a mouse.
 */
export const MIN_TOUCH_FONT_SIZE = 16;
