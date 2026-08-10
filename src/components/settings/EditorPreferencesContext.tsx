"use client";

import { createContext, useContext } from "react";

import { DEFAULT_EDITOR_PREFERENCES } from "@/config/editor";
import type { EditorPreferences } from "@/types/editor";

/**
 * The account's editor preferences as seen by everything that renders from them.
 *
 * Split from `EditorPreferencesProvider`, which holds the state and the save, so that the module the
 * *editors* import reaches nothing but React and a config object. The provider imports the Server
 * Action, and a Server Action module imports Prisma: in the browser Next replaces that import with a
 * network reference, but anything resolving the module graph literally — a unit test rendering
 * `MarkdownEditor` to static markup — would follow it all the way to a database client. One file
 * would have made every future component test that mounts an editor need a database URL.
 */

export interface EditorPreferencesContextValue {
    preferences: EditorPreferences;
    /** Applies a change immediately and saves it in the background. */
    update: (change: Partial<EditorPreferences>) => void;
}

export const EditorPreferencesContext = createContext<EditorPreferencesContextValue | null>(null);

/**
 * The preferences to render with.
 *
 * Deliberately tolerant of a missing provider, unlike `useSidebar`, which throws: the editors are
 * the callers here, and they are rendered in places that have no session behind them — a unit test
 * rendering `MarkdownEditor` to static markup, or any future surface outside the dashboard layout.
 * Falling back to the defaults there gives exactly what those editors showed before preferences
 * existed, which is a better failure than a crash in a component whose job is displaying text.
 */
export function useEditorPreferences(): EditorPreferences {
    return useContext(EditorPreferencesContext)?.preferences ?? DEFAULT_EDITOR_PREFERENCES;
}

/**
 * The preferences plus the writer, for the settings panel.
 *
 * This one throws without a provider, because a panel of controls that silently changes nothing is
 * a bug the defaults would hide.
 */
export function useEditorPreferencesControls(): EditorPreferencesContextValue {
    const context = useContext(EditorPreferencesContext);

    if (!context) {
        throw new Error(
            "useEditorPreferencesControls must be used within an EditorPreferencesProvider",
        );
    }

    return context;
}
