"use server";

import { editorPreferencesSchema } from "@/lib/editor-preferences";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/server/current-user";
import type { EditorPreferencesResult } from "@/types/editor";

/**
 * The Server Action that persists an account's editor preferences.
 *
 * The write end of the editor-preferences feature: `EditorPreferencesRows` on the settings page
 * calls this from a dropdown's `onChange`, and it validates the set against
 * `editorPreferencesSchema` before storing it in the `editorPreferences` JSON column.
 * `getEditorPreferences` in `server/profile.ts` reads it back in the dashboard layout, and every
 * editor surface receives it through `EditorPreferencesProvider`.
 */

/**
 * Stores the signed-in account's editor preferences. The account comes from the session, so no
 * payload names the user it writes to.
 *
 * @param preferences - The whole preference set, not the one control that moved: the panel holds all
 * five in state and sends what they should now be, which makes the write idempotent and means a
 * replay cannot compose a shape nobody chose. Typed `unknown` because it crosses the network and is
 * parsed below.
 *
 * @remarks
 * Validated here and not only in the panel: an exported action is a callable endpoint, and the
 * closed option sets are what keep a font size of `0` or an unknown theme out of the column every
 * editor in the application renders from.
 *
 * Nothing is revalidated afterwards. The provider already holds the new values — it applied them
 * before this was called — so a revalidation would refetch a layout in order to render what is
 * already on screen, and the next navigation reads the stored row anyway.
 */
export async function updateEditorPreferences(
    preferences: unknown,
): Promise<EditorPreferencesResult> {
    const userId = await getCurrentUserId();

    const parsed = editorPreferencesSchema.safeParse(preferences);

    if (!parsed.success) {
        return { success: false, error: "Those editor settings aren't valid." };
    }

    try {
        await prisma.user.update({
            where: { id: userId },
            data: { editorPreferences: parsed.data },
        });

        return { success: true };
    } catch (error) {
        console.error("Editor preferences update failed:", error);

        return { success: false, error: "Could not save your editor settings. Try again." };
    }
}
