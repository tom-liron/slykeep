import {
    EDITOR_MAX_HEIGHT,
    EDITOR_MAX_HEIGHT_DVH,
    EDITOR_MIN_HEIGHT,
    MIN_TOUCH_FONT_SIZE,
} from "@/config/editor";
import type { EditorFontSize } from "@/types/editor";

/**
 * The two numbers an editor renders at that are not simply the account's preference.
 *
 * Both exist because the same stored settings have to survive a device they were not chosen on, and
 * both are deliberately *rendering* rules: nothing here is ever written back, so a phone cannot
 * silently rewrite the preference that a desktop then inherits.
 */

/**
 * The font size to render at, which is the preference except under a finger.
 *
 * The floor is the whole rule. Ten of the app's other inputs would deserve it too if they used a
 * smaller size; the editors are where it bites, because the default is 13 and the dropdown offers
 * 12 — a snippet opened on a phone would zoom the page the moment it was tapped, and stay zoomed.
 *
 * It only ever raises. A preference above the floor is left alone, so choosing 18 still means 18.
 */
export function renderedFontSize(fontSize: EditorFontSize, coarsePointer: boolean): number {
    return coarsePointer ? Math.max(MIN_TOUCH_FONT_SIZE, fontSize) : fontSize;
}

/**
 * How tall an editor may grow, given the viewport it is growing in.
 *
 * The JavaScript half of `EDITOR_MAX_HEIGHT_CSS` — see `config/editor.ts` for why the rule is
 * written twice, and keep the two in step. The floor is applied last so that a viewport short enough
 * to make the ceiling smaller than `EDITOR_MIN_HEIGHT` cannot invert the two and hand back a
 * maximum below the minimum.
 */
export function editorMaxHeight(viewportHeight: number): number {
    const share = Math.round((viewportHeight * EDITOR_MAX_HEIGHT_DVH) / 100);

    return Math.max(EDITOR_MIN_HEIGHT, Math.min(EDITOR_MAX_HEIGHT, share));
}
