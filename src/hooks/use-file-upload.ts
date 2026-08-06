"use client";

import { useState } from "react";

import { validateUpload, type FileItemTypeName } from "@/lib/file-constraints";

/** What an upload leaves behind for the create dialog to submit with the rest of the form. */
export type UploadedFile = {
    key: string;
    fileName: string;
    fileSize: number;
};

/**
 * Sends one file to `POST /api/upload` and reports how much of it has gone out.
 *
 * `XMLHttpRequest` rather than `fetch`, and that is the whole reason this exists as its own module:
 * `fetch` cannot report how much of a *request* body has been sent, and `xhr.upload.onprogress` can.
 * On a 10 MB file over a slow connection that is the difference between a real answer and a spinner.
 * Everything here is that one constraint and its consequences — the response parsing included, since
 * an XHR hands back a string rather than something with `.json()`.
 *
 * The upload runs the moment a file is chosen rather than on submit, because progress is only
 * meaningful while something is happening. The cost is an object in R2 that no item points at if the
 * dialog is then abandoned; that trade is deliberate and recorded with the route.
 *
 * Outcomes are reported through callbacks rather than returned state, because the caller is holding
 * the uploaded file for its own payload and its own submit gate — two copies of that would be one
 * copy too many.
 */
export function useFileUpload({
    itemType,
    onUploaded,
    onError,
}: {
    itemType: FileItemTypeName;
    onUploaded: (file: UploadedFile) => void;
    onError: (message: string) => void;
}) {
    /** Percent complete, or null when nothing is in flight. */
    const [progress, setProgress] = useState<number | null>(null);

    const upload = (file: File) => {
        // The same rules the route enforces, run first only to spare an obviously doomed upload.
        // The route is the authority; this is never the only check.
        const validation = validateUpload(file, itemType);

        if (!validation.valid) {
            onError(validation.error);

            return;
        }

        const body = new FormData();
        body.append("file", file);
        body.append("itemType", itemType);

        const request = new XMLHttpRequest();

        setProgress(0);

        request.upload.onprogress = (event) => {
            if (event.lengthComputable) {
                setProgress(Math.round((event.loaded / event.total) * 100));
            }
        };

        request.onload = () => {
            setProgress(null);

            if (request.status >= 200 && request.status < 300) {
                const uploaded = safeUploadOf(request.responseText);

                if (uploaded) {
                    onUploaded(uploaded);
                } else {
                    // A 2xx that is not our JSON did not come from the route — a proxy, a captive
                    // portal, or a session that expired into a redirect.
                    onError("The upload did not complete. Try again.");
                }

                return;
            }

            // The route answers every refusal as `{ error }`; anything else came from further out.
            const message = safeErrorOf(request.responseText);

            onError(message ?? "Could not upload that file. Try again.");
        };

        request.onerror = () => {
            setProgress(null);
            onError("Could not reach the server. Check your connection and try again.");
        };

        request.open("POST", "/api/upload");
        request.send(body);
    };

    // `progress` alone, deliberately — no `isUploading` boolean beside it. The caller renders the
    // percentage inside its own `progress !== null` branch, and TypeScript narrows `number | null`
    // to `number` there only if the test is the caller's own. Returning the boolean instead means
    // `aria-valuenow` is handed a possible null, which is how this was caught.
    return { progress, upload };
}

/** A JSON body, or undefined when the response was not JSON at all (an HTML error page, say). */
function parseBody(body: string): Record<string, unknown> | undefined {
    try {
        const parsed: unknown = JSON.parse(body);

        return parsed && typeof parsed === "object"
            ? (parsed as Record<string, unknown>)
            : undefined;
    } catch {
        return undefined;
    }
}

/** The `error` a refusal carries, when the response is the shape this route sends. */
function safeErrorOf(body: string): string | undefined {
    const { error } = parseBody(body) ?? {};

    return typeof error === "string" ? error : undefined;
}

/** The upload a success carries, checked field by field rather than asserted. */
function safeUploadOf(body: string): UploadedFile | undefined {
    const { key, fileName, fileSize } = parseBody(body) ?? {};

    if (typeof key !== "string" || typeof fileName !== "string" || typeof fileSize !== "number") {
        return undefined;
    }

    return { key, fileName, fileSize };
}
