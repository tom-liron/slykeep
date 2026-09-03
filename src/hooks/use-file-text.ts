"use client";

import { useEffect, useState } from "react";

/**
 * Loads a stored file's own bytes as text, for the formats the drawer renders inline rather than
 * offering as a download.
 *
 * The second half of how a file item opens. `ItemDrawer` gets the item's metadata from
 * `/api/items/[id]`, asks `filePreviewFor` in `lib/file-preview.ts` which viewer that file belongs
 * in, and only then enables this hook — which reads the object itself through `/api/files/[id]`,
 * the route that authorizes the request and streams it out of R2.
 */

/**
 * Fetches the object's text once enabled, and reports it or the reason it could not be read.
 *
 * @param fileUrl - The item's own file route, `/api/files/<item id>`.
 * @param enabled - Gates the fetch. The hook keys off this rather than off the item being a FILE, so
 * nothing reaches object storage until the preview rule has said the object is text small enough to
 * render.
 *
 * @remarks
 * `/api/items/[id]` answers from Postgres alone and must not start reading R2 for every item that
 * happens to be a file, which is why the bytes are a separate request.
 */
export function useFileText(fileUrl: string, enabled: boolean) {
    const [fileText, setFileText] = useState("");
    const [fileError, setFileError] = useState("");

    useEffect(() => {
        if (!enabled) return;

        // Aborted on unmount, so a response for a file the drawer has since closed on does not set
        // state on a component that is gone.
        const controller = new AbortController();

        fetch(fileUrl, { signal: controller.signal })
            .then((response) => {
                if (!response.ok) throw new Error("Could not load this file.");

                return response.text();
            })
            .then(setFileText)
            .catch((cause: Error) => {
                if (cause.name !== "AbortError") {
                    setFileError(cause.message || "Could not load this file.");
                }
            });

        return () => controller.abort();
    }, [fileUrl, enabled]);

    return { fileText, fileError };
}
