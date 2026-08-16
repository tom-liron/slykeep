import { describe, expect, it } from "vitest";

import { editorMaxHeight, renderedFontSize } from "./editor-metrics";
import {
    EDITOR_FONT_SIZES,
    EDITOR_MAX_HEIGHT,
    EDITOR_MIN_HEIGHT,
    MIN_TOUCH_FONT_SIZE,
} from "@/config/editor";

/**
 * Both of these are two-line functions whose failure modes are silent: a floor written as `min`
 * still returns a number, and a ceiling that inverts against the floor still renders an editor. What
 * is pinned here is the direction of each clamp, not the arithmetic.
 */
describe("renderedFontSize", () => {
    it("leaves every offered size alone on a mouse", () => {
        for (const fontSize of EDITOR_FONT_SIZES) {
            expect(renderedFontSize(fontSize, false)).toBe(fontSize);
        }
    });

    it("raises the sizes that would zoom iOS on focus", () => {
        expect(renderedFontSize(12, true)).toBe(MIN_TOUCH_FONT_SIZE);
        expect(renderedFontSize(13, true)).toBe(MIN_TOUCH_FONT_SIZE);
        expect(renderedFontSize(14, true)).toBe(MIN_TOUCH_FONT_SIZE);
    });

    it("never lowers a size that is already large enough", () => {
        expect(renderedFontSize(16, true)).toBe(16);
        expect(renderedFontSize(18, true)).toBe(18);
    });
});

describe("editorMaxHeight", () => {
    it("does not shrink the editor on a viewport tall enough for the full ceiling", () => {
        // A phone held upright is the exact boundary: 60% of 667 is 400.
        expect(editorMaxHeight(667)).toBe(EDITOR_MAX_HEIGHT);
        expect(editorMaxHeight(900)).toBe(EDITOR_MAX_HEIGHT);
    });

    it("takes a share of the viewport when the screen is shorter than the ceiling", () => {
        // A landscape phone, where 400px of editor is the whole screen.
        expect(editorMaxHeight(375)).toBe(225);
    });

    it("never returns a ceiling below the floor", () => {
        expect(editorMaxHeight(100)).toBe(EDITOR_MIN_HEIGHT);
        expect(editorMaxHeight(0)).toBe(EDITOR_MIN_HEIGHT);
    });
});
