"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { updateEditorPreferences } from "@/actions/editor-preferences";
import { EditorPreferencesContext } from "@/components/settings/EditorPreferencesContext";
import type { EditorPreferences } from "@/types/editor";

/**
 * Holds the account's editor preferences for the signed-in tree, and saves every change as it is
 * made.
 *
 * Mounted in the dashboard layout rather than on the settings page, because the page that *edits*
 * them is not the page that needs them: every editor in the app renders from these, and they mount
 * in the drawer, the create dialog, and the edit form. One read in the layout feeds all of it, and
 * the settings panel is simply another consumer that happens to write back.
 *
 * It lives in `settings/` anyway — that is where the feature is owned — the same way the layout
 * imports `SidebarProvider` from `layout/`.
 */

/**
 * One toast id shared by every save, so stepping through five font sizes replaces one toast five
 * times rather than stacking five.
 */
const SAVE_TOAST_ID = "editor-preferences";

export function EditorPreferencesProvider({
    preferences: initial,
    children,
}: {
    preferences: EditorPreferences;
    children: ReactNode;
}) {
    const [preferences, setPreferences] = useState(initial);

    // What is on screen, and what the server last accepted. The first is read when composing the
    // next value — a ref rather than the state, so `update` never has to be rebuilt and never runs
    // the save from inside a state updater, which React may invoke twice.
    const current = useRef(initial);
    const saved = useRef(initial);

    // Which save is the newest. Two dropdown changes in flight can settle out of order, and only the
    // last one may touch what is on screen; an older failure that reverted would silently undo a
    // newer change the user has already seen applied.
    const latestSave = useRef(0);

    const update = useCallback((change: Partial<EditorPreferences>) => {
        const next = { ...current.current, ...change };

        current.current = next;
        setPreferences(next);

        const save = ++latestSave.current;

        void updateEditorPreferences(next).then((result) => {
            if (result.success) {
                saved.current = next;

                if (save === latestSave.current) {
                    toast.success("Editor settings saved", { id: SAVE_TOAST_ID });
                }

                return;
            }

            toast.error(result.error, { id: SAVE_TOAST_ID });

            // Roll back to the last value the database actually holds, so the panel stops showing a
            // setting that was never stored. Only the newest save may do this.
            if (save === latestSave.current) {
                current.current = saved.current;
                setPreferences(saved.current);
            }
        });
    }, []);

    return (
        <EditorPreferencesContext.Provider value={{ preferences, update }}>
            {children}
        </EditorPreferencesContext.Provider>
    );
}
