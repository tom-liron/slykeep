/**
 * What a user may change about how their content editors render.
 *
 * Declared here, next to `item-type.ts`, for the same reason that file exists: these are the
 * compile-time contracts, and the values that satisfy them — the option lists a dropdown offers,
 * the theme catalog, and the defaults — are runtime configuration in `config/editor.ts`.
 *
 * The option unions are narrow on purpose. Font size and tab size arrive from a JSON column and
 * from a `<select>`, so "any number" would let a stored `0` or a hand-made request collapse the
 * editor; a closed set means the only values that reach monaco are ones a dropdown could have
 * produced.
 */

export type EditorFontSize = 12 | 13 | 14 | 16 | 18;

export type EditorTabSize = 2 | 4 | 8;

/**
 * A monaco theme id.
 *
 * `vs-dark` and `hc-black` are monaco's own. The other three are registered by `CodeEditor` in
 * `beforeMount`, and all three are `vs-dark` with `inherit: true` rather than full themes —
 * `devstash-dark` overrides only the chrome, so an editor sits on the app's surface, and `monokai`
 * and `github-dark` add a handful of token colours on top of that. Inheriting is what makes them
 * affordable: everything not named falls through to `vs-dark`, so neither is a syntax palette to
 * maintain per language.
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

export interface EditorPreferences {
    fontSize: EditorFontSize;
    tabSize: EditorTabSize;
    wordWrap: boolean;
    minimap: boolean;
    theme: EditorThemeId;
}

/**
 * What the update action hands back.
 *
 * A discriminated union rather than the account actions' `AccountActionState`, because this one is
 * not a form: it is called from a dropdown's `onChange` with an object, not from `useActionState`
 * with a `FormData`, and there is no per-field error to report — a preference is either one of the
 * offered values or it never left the control. Lives here for the same reason `AccountActionState`
 * lives in `types/account.ts`: a `"use server"` module may only export async functions.
 */
export type EditorPreferencesResult = { success: true } | { success: false; error: string };
