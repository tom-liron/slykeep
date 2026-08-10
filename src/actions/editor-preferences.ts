"use server";

import { editorPreferencesSchema } from "@/lib/editor-preferences";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/server/current-user";
import type { EditorPreferencesResult } from "@/types/editor";

/**
 * Persists the signed-in account's editor preferences.
 *
 * A Server Action rather than a route handler, by the same rule as the account mutations: the caller
 * needs to know whether it worked and, if not, what to say — no status code, no webhook, no upload.
 * The account comes from the session, so no payload names the user it writes to.
 *
 * It takes the whole preference set rather than the one control that moved. The panel holds all five
 * in state and sends what they should now be, which makes the write idempotent and means a replay
 * cannot compose a shape nobody chose — the alternative, a patch merged server-side, would need a
 * read before every write to do the same job.
 *
 * Nothing is revalidated afterwards. The values are served to the tree by a provider that already
 * holds the new ones — it applied them before this was called — so a revalidation would refetch a
 * layout in order to render exactly what is on screen. The next navigation reads the stored row
 * anyway.
 */
export async function updateEditorPreferences(
    preferences: unknown,
): Promise<EditorPreferencesResult> {
    const userId = await getCurrentUserId();

    // Validated here and not only in the panel: this is an exported action, so it is a callable
    // endpoint, and the closed option sets are what keep a font size of 0 or an unknown theme out
    // of the column that every editor in the app renders from.
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
