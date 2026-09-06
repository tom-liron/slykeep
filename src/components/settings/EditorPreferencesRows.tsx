"use client";

import { ChevronDown } from "lucide-react";

import { useEditorPreferencesControls } from "@/components/settings/EditorPreferencesContext";
import { PanelRow } from "@/components/ui/Panel";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    EDITOR_FONT_SIZES,
    EDITOR_TAB_SIZES,
    EDITOR_THEME_CATALOG,
    EDITOR_THEME_IDS,
} from "@/config/editor";

/**
 * The five rows of the settings page's Item editor panel — font size, tab size, word wrap,
 * minimap, theme — wired through `useEditorPreferencesControls`.
 *
 * Just the rows, not the `Panel`, so the page keeps rendering `Panel` as a server component and
 * only the controls cross to the client. No form and no save button: each control writes through
 * `EditorPreferencesProvider` as it changes.
 */
export function EditorPreferencesRows() {
    const { preferences, update } = useEditorPreferencesControls();

    return (
        <>
            <PanelRow title="Font Size" description="How large code and prose are in the editor.">
                <PreferenceSelect
                    label="Font Size"
                    value={preferences.fontSize}
                    options={EDITOR_FONT_SIZES.map((size) => ({
                        value: size,
                        label: `${size}px`,
                    }))}
                    onChange={(fontSize) => update({ fontSize })}
                />
            </PanelRow>

            <PanelRow title="Tab Size" description="How many spaces one indent level is worth.">
                <PreferenceSelect
                    label="Tab Size"
                    value={preferences.tabSize}
                    options={EDITOR_TAB_SIZES.map((size) => ({
                        value: size,
                        label: `${size} spaces`,
                    }))}
                    onChange={(tabSize) => update({ tabSize })}
                />
            </PanelRow>

            <PanelRow
                title="Word Wrap"
                description="Wrap long lines instead of scrolling sideways to read them."
            >
                <Switch
                    checked={preferences.wordWrap}
                    onCheckedChange={(wordWrap) => update({ wordWrap })}
                    aria-label="Word Wrap"
                />
            </PanelRow>

            <PanelRow
                title="Minimap"
                description="Show the scaled-down overview of the file down the right edge."
            >
                <Switch
                    checked={preferences.minimap}
                    onCheckedChange={(minimap) => update({ minimap })}
                    aria-label="Minimap"
                />
            </PanelRow>

            <PanelRow title="Theme" description="The colours code is highlighted in.">
                <PreferenceSelect
                    label="Theme"
                    value={preferences.theme}
                    options={EDITOR_THEME_IDS.map((id) => ({
                        value: id,
                        label: EDITOR_THEME_CATALOG[id].label,
                    }))}
                    onChange={(theme) => update({ theme })}
                />
            </PanelRow>
        </>
    );
}

/**
 * A pick-one control built from `DropdownMenu` + a radio group, for the three select-style
 * preference rows (font size, tab size, theme).
 *
 * @remarks
 * Generic over the option type: font and tab sizes are numbers, the theme is a string union, and
 * Radix radio items carry a `string`. The chosen string is matched back through the options list,
 * so `onChange` hands the caller its own union type, not a parsed number that could be `NaN`.
 */
function PreferenceSelect<T extends string | number>({
    label,
    value,
    options,
    onChange,
}: {
    label: string;
    value: T;
    options: { value: T; label: string }[];
    onChange: (value: T) => void;
}) {
    const selected = options.find((option) => option.value === value);

    return (
        <DropdownMenu>
            {/* The label is the row's heading, which is not associated with this control, so the
                trigger names itself for assistive tech. Sighted users read the pair as a row. */}
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" aria-label={label}>
                    {selected?.label ?? String(value)}
                    <ChevronDown data-icon="inline-end" aria-hidden="true" />
                </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="min-w-36">
                <DropdownMenuRadioGroup
                    value={String(value)}
                    onValueChange={(next) => {
                        const option = options.find(
                            (candidate) => String(candidate.value) === next,
                        );

                        if (option) {
                            onChange(option.value);
                        }
                    }}
                >
                    {options.map((option) => (
                        <DropdownMenuRadioItem
                            key={String(option.value)}
                            value={String(option.value)}
                        >
                            {option.label}
                        </DropdownMenuRadioItem>
                    ))}
                </DropdownMenuRadioGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
