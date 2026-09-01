"use client";

import { useEffect, useState } from "react";

/**
 * A file item's own bytes, for the formats that are rendered rather than downloaded.
 *
 * Separate from the item's detail on purpose, and gated on `enabled` rather than on being a file:
 * `/api/items/[id]` answers from Postgres and must not start reading object storage for every item
 * that happens to be a file. This runs only once that detail has said the object is text small
 * enough to render, which is a question only `filePreviewFor` can answer.
 */
export function useFileText(fileUrl: string, enabled: boolean) {
    const [fileText, setFileText] = useState("");
    const [fileError, setFileError] = useState("");

    useEffect(() => {
        if (!enabled) return;

        // A second request, deliberately: `/api/items/[id]` answers from Postgres and must not start
        // reading object storage for every item that happens to be a file. This one runs only once
        // the detail has said the object is text small enough to render.
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
