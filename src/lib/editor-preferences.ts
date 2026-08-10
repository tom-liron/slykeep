import { z } from "zod";

import {
    DEFAULT_EDITOR_PREFERENCES,
    EDITOR_FONT_SIZES,
    EDITOR_TAB_SIZES,
    EDITOR_THEME_IDS,
} from "@/config/editor";
import type { EditorPreferences } from "@/types/editor";

/**
 * Input contract for the editor preferences, and the one way the stored JSON becomes a usable value.
 *
 * Both directions matter here, which is why this is a `lib` module rather than a schema next to the
 * action: the write path validates what a client sends, and the read path has to survive whatever is
 * already in the column. A `Json` column has no shape — it holds what some earlier release wrote, so
 * a theme that has since been dropped, a font size that was offered once, or a hand-edited row are
 * all things a query can hand back, and none of them may be allowed to reach monaco.
 */

/**
 * Built from the same arrays the dropdowns render, so the set a user can pick from and the set the
 * server accepts are the same set by construction. Adding an option is one edit in `config/editor.ts`.
 */
export const editorPreferencesSchema = z.object({
    fontSize: z.literal(EDITOR_FONT_SIZES),
    tabSize: z.literal(EDITOR_TAB_SIZES),
    wordWrap: z.boolean(),
    minimap: z.boolean(),
    theme: z.enum(EDITOR_THEME_IDS),
});

/**
 * One stored field, or the default in its place.
 *
 * Field by field rather than one `safeParse` of the whole object, because those two differ in
 * exactly the case this exists for: a row written before an option was retired parses everything
 * except that one key, and validating the object as a unit would throw the user's other four
 * settings away with it.
 */
function pick<K extends keyof EditorPreferences>(
    key: K,
    source: Record<string, unknown>,
): EditorPreferences[K] {
    const parsed = editorPreferencesSchema.shape[key].safeParse(source[key]);

    return parsed.success ? (parsed.data as EditorPreferences[K]) : DEFAULT_EDITOR_PREFERENCES[key];
}

/**
 * The stored `User.editorPreferences` value, made safe to render with.
 *
 * Total by design — it returns a complete set of preferences for any input at all, including the
 * `null` every account starts with. Nothing downstream then has to decide what a missing or
 * malformed preference means, and no editor ever receives a partial object.
 */
export function parseEditorPreferences(stored: unknown): EditorPreferences {
    const source =
        typeof stored === "object" && stored !== null && !Array.isArray(stored)
            ? (stored as Record<string, unknown>)
            : {};

    return {
        fontSize: pick("fontSize", source),
        tabSize: pick("tabSize", source),
        wordWrap: pick("wordWrap", source),
        minimap: pick("minimap", source),
        theme: pick("theme", source),
    };
}
