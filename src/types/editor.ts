/**
 * The compile-time contracts of the editor-preferences feature: what a user may change about how
 * an item's content editor renders, and what the action that stores it hands back.
 *
 * These are the types; the values that satisfy them — the option lists a dropdown offers, the theme
 * catalog and the defaults — are runtime configuration in `config/editor.ts`, the same division
 * `item-type.ts` and `config/item-type-catalog.ts` follow. A preference travels from
 * `EditorPreferencesRows` through `updateEditorPreferences` in `actions/editor-preferences.ts` into
 * a JSON column, is validated back out by `lib/editor-preferences.ts`, and is handed to `CodeEditor`
 * and its two sibling surfaces through `EditorPreferencesProvider`.
 *
 * @remarks
 * The option unions are narrow rather than `number`. A stored value arrives from a JSON column and
 * from a `<select>`, so a closed set is what keeps a hand-made `0` from reaching monaco and
 * collapsing the editor.
 */

/** The font sizes the settings dropdown offers, in points. */
export type EditorFontSize = 12 | 13 | 14 | 16 | 18;

/** The tab widths the settings dropdown offers, in spaces. */
export type EditorTabSize = 2 | 4 | 8;

/**
 * A monaco theme id.
 *
 * `vs-dark` and `hc-black` are monaco's own. `CodeEditor` registers the other three in `beforeMount`
 * as `vs-dark` with `inherit: true`: `devstash-dark` overrides the chrome so an editor sits on the
 * app's surface colour, and `monokai` and `github-dark` add a handful of token colours on top.
 *
 * @remarks
 * Everything an inheriting theme does not name falls through to `vs-dark`, so none of the three is a
 * per-language syntax palette to maintain.
 */
export type EditorThemeId = "devstash-dark" | "monokai" | "github-dark" | "vs-dark" | "hc-black";

/** How a theme is offered, and the surface the editor's frame has to match while it is active. */
export interface EditorThemePresentation {
    label: string;
    /**
     * The theme's `editor.background`, needed outside monaco: both editors paint their own frame —
     * the header band, the border, the markdown panels — and monaco cannot tell them what colour it
     * is about to use. Without this the frame stays one colour while the body changes under it.
     */
    surface: string;
}

/** One account's stored editor settings, as every editor surface receives them. */
export interface EditorPreferences {
    fontSize: EditorFontSize;
    tabSize: EditorTabSize;
    wordWrap: boolean;
    minimap: boolean;
    theme: EditorThemeId;
}

/**
 * What `updateEditorPreferences` hands back.
 *
 * A discriminated union rather than the form-state shape the account actions return: this action is
 * called from a dropdown's `onChange` with an object rather than from `useActionState` with a
 * `FormData`, and a preference is either one of the offered values or it never left the control, so
 * there is no per-field error to report. It lives here for the reason `AccountActionState` lives in
 * `types/account.ts`.
 */
export type EditorPreferencesResult = { success: true } | { success: false; error: string };
