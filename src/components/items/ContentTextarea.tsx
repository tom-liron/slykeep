"use client";

import { useEditorPreferences } from "@/components/settings/EditorPreferencesContext";
import { EDITOR_MAX_HEIGHT_CSS, EDITOR_MIN_HEIGHT } from "@/config/editor";
import { useCoarsePointer } from "@/hooks/use-coarse-pointer";
import { renderedFontSize } from "@/lib/editor-metrics";
import { cn } from "@/lib/utils";

/**
 * The plain `<textarea>` writing surface for `MarkdownEditor` and touch editing.
 *
 * `MarkdownEditor` uses it for its Write tab at every pointer type; editable `CodeEditor` uses it
 * as the coarse-pointer fallback. Both editors share its height, font, wrapping, and preference
 * behavior.
 */

/** The scroll-panel classes both editors share, so a note and a snippet sit in the drawer with
 * the same furniture. */
export const EDITOR_PANEL = "app-scrollbar overflow-y-auto";

/**
 * The floor and ceiling every panel is bounded by. Inline rather than Tailwind's `min-h-[76px]`,
 * because the values come from a module and Tailwind cannot generate a class from one — the
 * documented exception in `coding-standards.md`.
 */
export const EDITOR_PANEL_BOUNDS = {
    minHeight: EDITOR_MIN_HEIGHT,
    maxHeight: EDITOR_MAX_HEIGHT_CSS,
};

export function ContentTextarea({
    id,
    value,
    onChange,
    placeholder,
    label,
    code = false,
    readOnly = false,
}: {
    /** The textarea's, so the `Field` label above it points at something real. */
    id?: string;
    value: string;
    onChange?: (value: string) => void;
    placeholder?: string;
    /** Names the editor for assistive tech, since the visible label is outside the component. */
    label: string;
    /**
     * Whether what is being typed is code rather than prose. It buys one thing, and only on a
     * phone: the platform's autocapitalize and autocorrect are turned off. Both are right for a
     * note and wrong for an identifier — iOS will capitalize `const` at the start of a line and
     * "correct" a variable name into a dictionary word.
     */
    code?: boolean;
    /**
     * Renders the text without allowing edits. Set when this stands in for a read-only
     * `CodeEditor` whose monaco build could not be loaded.
     */
    readOnly?: boolean;
}) {
    const preferences = useEditorPreferences();
    const coarsePointer = useCoarsePointer();

    return (
        <textarea
            id={id}
            value={value}
            onChange={(event) => onChange?.(event.target.value)}
            readOnly={readOnly}
            placeholder={placeholder}
            aria-label={label}
            spellCheck={false}
            // The native way to stop soft wrapping; monaco's `wordWrap: "off"` reaches the same
            // place from the other side. Both then scroll sideways instead.
            wrap={preferences.wordWrap ? "soft" : "off"}
            {...(code ? { autoCapitalize: "off", autoCorrect: "off", autoComplete: "off" } : null)}
            // `fontSize` is the preference except under a finger, where it is floored so that
            // focusing the field does not zoom the page — see `renderedFontSize`. `tabSize` is what
            // a literal tab is rendered as, and it is the same number monaco is given, so a snippet
            // and a note are set in the same type.
            style={{
                ...EDITOR_PANEL_BOUNDS,
                fontSize: renderedFontSize(preferences.fontSize, coarsePointer),
                tabSize: preferences.tabSize,
            }}
            className={cn(
                EDITOR_PANEL,
                "block w-full resize-none bg-transparent px-3 py-3 font-mono leading-relaxed outline-none placeholder:text-muted-foreground",
                // Grows with what is typed, the way the code editor follows its content height.
                // `Textarea` in `ui/` already relies on this.
                "field-sizing-content",
            )}
        />
    );
}
