import { z } from "zod";

import {
    DEFAULT_EDITOR_PREFERENCES,
    EDITOR_FONT_SIZES,
    EDITOR_TAB_SIZES,
    EDITOR_THEME_IDS,
} from "@/config/editor";
import type { EditorPreferences } from "@/types/editor";

/**
 * The editor-preferences contract, in both directions: validating what a client submits, and making
 * the stored `User.editorPreferences` JSON safe to render with.
 *
 * `actions/editor-preferences.ts` parses a write against {@link editorPreferencesSchema}; the code
 * editors read the stored value through {@link parseEditorPreferences}. A `lib` module rather than
 * a schema beside the action because both directions matter.
 *
 * @remarks
 * A `Json` column has no shape, so a query can return a value that does not match the current
 * options — a theme absent from the catalog, a hand-edited row — and none may reach monaco.
 */

/**
 * Built from the same arrays the dropdowns render, so the set a user can pick and the set the
 * server accepts are one set by construction. Adding an option is one edit in `config/editor.ts`.
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
 * Field by field rather than one `safeParse` of the whole object, because those differ in exactly
 * the case this exists for: when one stored value no longer matches its option set, the other four
 * still parse, and validating the object as a unit would discard them along with it.
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
 * Total by design: it returns a complete set of preferences for any input, including the `null`
 * every account starts with, so nothing downstream has to decide what a missing or malformed
 * preference means and no editor receives a partial object.
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
