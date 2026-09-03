import {
    EDITOR_MAX_HEIGHT,
    EDITOR_MAX_HEIGHT_DVH,
    EDITOR_MIN_HEIGHT,
    MIN_TOUCH_FONT_SIZE,
} from "@/config/editor";
import type { EditorFontSize } from "@/types/editor";

/**
 * The two editor numbers that are computed at render time rather than taken straight from the
 * account's stored preference.
 *
 * `CodeEditor` calls {@link renderedFontSize} with the pointer type and {@link editorMaxHeight}
 * with the viewport height.
 *
 * @remarks
 * Both are rendering rules only — nothing here is written back, so a phone cannot rewrite a
 * preference that a desktop then inherits.
 */

/**
 * The font size to render at: the stored preference, raised to {@link MIN_TOUCH_FONT_SIZE} on a
 * coarse pointer.
 *
 * @remarks
 * The default is 13 and the dropdown offers 12, so a snippet opened on a phone would zoom the page
 * the moment it was tapped. The floor only ever raises — a preference above it, such as 18, is left
 * alone.
 */
export function renderedFontSize(fontSize: EditorFontSize, coarsePointer: boolean): number {
    return coarsePointer ? Math.max(MIN_TOUCH_FONT_SIZE, fontSize) : fontSize;
}

/**
 * How tall an editor may grow in the viewport it is growing in.
 *
 * The JavaScript half of `EDITOR_MAX_HEIGHT_CSS` — `config/editor.ts` explains why the rule is
 * written twice; keep the two in step. The floor is applied last, so a viewport short enough to
 * make the share smaller than `EDITOR_MIN_HEIGHT` cannot hand back a maximum below the minimum.
 */
export function editorMaxHeight(viewportHeight: number): number {
    const share = Math.round((viewportHeight * EDITOR_MAX_HEIGHT_DVH) / 100);

    return Math.max(EDITOR_MIN_HEIGHT, Math.min(EDITOR_MAX_HEIGHT, share));
}
