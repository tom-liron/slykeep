"use client";

import { createContext, useContext } from "react";

import { DEFAULT_EDITOR_PREFERENCES } from "@/config/editor";
import type { EditorPreferences } from "@/types/editor";

/**
 * The React context and hooks for the account's editor preferences, read by every editor in the
 * app.
 *
 * Split from `EditorPreferencesProvider` (which holds the state and the save) so the module the
 * editors import reaches nothing but React and a config object. The provider imports the Server
 * Action, which imports Prisma; a unit test that renders an editor to static markup would follow
 * that graph to a database client if the two were one file.
 */

export interface EditorPreferencesContextValue {
    preferences: EditorPreferences;
    /** Applies a change immediately and saves it in the background. */
    update: (change: Partial<EditorPreferences>) => void;
}

export const EditorPreferencesContext = createContext<EditorPreferencesContextValue | null>(null);

/**
 * The preferences to render an editor with.
 *
 * Falls back to {@link DEFAULT_EDITOR_PREFERENCES} with no provider, rather than throwing: the
 * editors call this, and they render outside the dashboard layout too (a unit test, a future
 * surface), where a crash in a text-display component would be the worse outcome.
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
