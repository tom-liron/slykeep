import { describe, expect, it } from "vitest";

import { editorPreferencesSchema, parseEditorPreferences } from "./editor-preferences";
import { DEFAULT_EDITOR_PREFERENCES } from "@/config/editor";

/**
 * The parse is the boundary between a column that can hold anything and five values that reach
 * monaco, so the cases worth pinning are the malformed ones: a null column, a shape from an older
 * release, and a single retired option among four good ones.
 */
describe("parseEditorPreferences", () => {
    it("returns the defaults for an account that has never saved any", () => {
        expect(parseEditorPreferences(null)).toEqual(DEFAULT_EDITOR_PREFERENCES);
    });

    it("returns the defaults for a stored value that is not an object", () => {
        for (const stored of ["13", 13, true, [], undefined]) {
            expect(parseEditorPreferences(stored)).toEqual(DEFAULT_EDITOR_PREFERENCES);
        }
    });

    it("reads a complete stored set back unchanged", () => {
        const stored = {
            fontSize: 16,
            tabSize: 4,
            wordWrap: false,
            minimap: true,
            theme: "vs-dark",
        };

        expect(parseEditorPreferences(stored)).toEqual(stored);
    });

    it("keeps the valid fields when one of them is no longer an offered option", () => {
        // The case this exists for: a row written when some other theme was on the menu. Validating
        // the object as a unit would throw the other four settings away with the theme.
        const result = parseEditorPreferences({
            fontSize: 18,
            tabSize: 8,
            wordWrap: false,
            minimap: true,
            theme: "solarized-dark",
        });

        expect(result).toEqual({
            fontSize: 18,
            tabSize: 8,
            wordWrap: false,
            minimap: true,
            theme: DEFAULT_EDITOR_PREFERENCES.theme,
        });
    });

    it("fills in fields the stored object never had", () => {
        expect(parseEditorPreferences({ fontSize: 14 })).toEqual({
            ...DEFAULT_EDITOR_PREFERENCES,
            fontSize: 14,
        });
    });

    it("rejects sizes outside the offered set rather than passing them through", () => {
        // A font size of 0 collapses the editor and a tab size of 40 makes one indent the whole
        // width; neither can be produced by a dropdown, so neither may survive a hand-made row.
        const result = parseEditorPreferences({ fontSize: 0, tabSize: 40 });

        expect(result.fontSize).toBe(DEFAULT_EDITOR_PREFERENCES.fontSize);
        expect(result.tabSize).toBe(DEFAULT_EDITOR_PREFERENCES.tabSize);
    });
});

/**
 * The write path is stricter than the read path on purpose: the action is a callable endpoint, and
 * a payload is either exactly one of the offered sets or it is refused outright.
 */
describe("editorPreferencesSchema", () => {
    it("accepts the defaults", () => {
        expect(editorPreferencesSchema.safeParse(DEFAULT_EDITOR_PREFERENCES).success).toBe(true);
    });

    it("refuses a partial payload", () => {
        expect(editorPreferencesSchema.safeParse({ fontSize: 14 }).success).toBe(false);
    });

    it("refuses values outside the offered sets", () => {
        const payloads = [
            { ...DEFAULT_EDITOR_PREFERENCES, fontSize: 11 },
            { ...DEFAULT_EDITOR_PREFERENCES, tabSize: 3 },
            { ...DEFAULT_EDITOR_PREFERENCES, theme: "solarized-dark" },
            { ...DEFAULT_EDITOR_PREFERENCES, wordWrap: "on" },
        ];

        for (const payload of payloads) {
            expect(editorPreferencesSchema.safeParse(payload).success).toBe(false);
        }
    });
});
