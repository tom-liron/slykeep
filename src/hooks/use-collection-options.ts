"use client";

import { useEffect, useState } from "react";

import type { CollectionOptionViewModel } from "@/types/view-models";

/**
 * Loads the collections the signed-in user can file an item into, for the picker on both item forms.
 *
 * `CreateItemDialog` and `ItemEditForm` are client components, so they cannot read the database the
 * way a page does; they call `GET /api/collections`, which authorizes the request and returns the
 * user's own collections as {@link CollectionOptionViewModel}s.
 */

/**
 * Fetches the picker's options once, on mount.
 *
 * @returns `options` (null until the fetch lands), `failed`, and `isLoading` — three states rather
 * than two, because an empty account and a failed request are different things to render.
 *
 * @remarks
 * Fetching on mount is the same thing as "when the form opens" for both callers: Radix unmounts the
 * create dialog's content on close, and the edit form is mounted only while the drawer is in edit
 * mode. A collection created in between is therefore picked up with no cache to invalidate, and
 * opening an item merely to read it fetches nothing.
 *
 * A failure is reported as picker state rather than as a message the user must act on. The picker is
 * one field on a form whose other fields still work, so it renders as "could not be loaded" and the
 * item saves with `collectionIds` left out of the payload — which the update contract already reads
 * as "leave them alone".
 */
export function useCollectionOptions() {
    const [options, setOptions] = useState<CollectionOptionViewModel[] | null>(null);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        // Aborted on unmount, so a response that arrives after the dialog was dismissed does not set
        // state on a component that is gone.
        const controller = new AbortController();

        fetch("/api/collections", { signal: controller.signal })
            .then(async (response) => {
                if (!response.ok) throw new Error("Could not load collections.");

                return (await response.json()) as CollectionOptionViewModel[];
            })
            .then(setOptions)
            .catch((cause: Error) => {
                // An abort is the unmount path, not a failure the picker should report.
                if (cause.name !== "AbortError") setFailed(true);
            });

        return () => controller.abort();
    }, []);

    return { options, failed, isLoading: options === null && !failed };
}
