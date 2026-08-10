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
 * The Editor panel's rows: the five controls, wired straight to the provider.
 *
 * The rows rather than the whole panel, so `Panel` stays where it is — rendered by the page as a
 * server component, with only the controls inside it crossing to the client. There is no form and no
 * save button: each control writes as it changes, which is why every one of them is its own row
 * rather than fields in a group waiting on a submit.
 */
export function EditorPreferencesRows() {
    const { preferences, update } = useEditorPreferencesControls();

    return (
        <>
            <PanelRow title="Font size" description="How large code and prose are in the editor.">
                <PreferenceSelect
                    label="Font size"
                    value={preferences.fontSize}
                    options={EDITOR_FONT_SIZES.map((size) => ({
                        value: size,
                        label: `${size}px`,
                    }))}
                    onChange={(fontSize) => update({ fontSize })}
                />
            </PanelRow>

            <PanelRow title="Tab size" description="How many spaces one indent level is worth.">
                <PreferenceSelect
                    label="Tab size"
                    value={preferences.tabSize}
                    options={EDITOR_TAB_SIZES.map((size) => ({
                        value: size,
                        label: `${size} spaces`,
                    }))}
                    onChange={(tabSize) => update({ tabSize })}
                />
            </PanelRow>

            <PanelRow
                title="Word wrap"
                description="Wrap long lines instead of scrolling sideways to read them."
            >
                <Switch
                    checked={preferences.wordWrap}
                    onCheckedChange={(wordWrap) => update({ wordWrap })}
                    aria-label="Word wrap"
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
 * A one-of-several control, built from the dropdown menu the sidebar's account menu already uses
 * rather than from a new select primitive — three to five options in a settings row is what a menu
 * with a radio group is for, and it is already styled, keyboard-navigable, and in the bundle.
 *
 * Generic over the option type because font and tab sizes are numbers while the theme is a string
 * union, and radix radio items carry a `string` value. The round trip goes through the options list
 * — the chosen string is matched back to the option it was rendered from — so the callback hands the
 * caller its own union type, not a parsed number that could be `NaN`.
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
