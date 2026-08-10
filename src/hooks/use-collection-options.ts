"use client";

import { useEffect, useState } from "react";

import type { CollectionOptionViewModel } from "@/types/view-models";

/**
 * The collections the signed-in user can file an item into, for the picker on both item forms.
 *
 * Fetched on mount, which is the same thing as "when the form opens" for both callers: Radix unmounts
 * the create dialog's content when it closes, and the edit form is mounted only while the drawer is
 * in edit mode. So a collection created in between is picked up without anything having to invalidate
 * a cache — and nothing is fetched at all for the far more common case of opening an item to read it.
 *
 * A failure is not surfaced as a message the user has to act on. The picker is one field on a form
 * whose other fields still work, so it renders as "could not be loaded" and the item saves without
 * touching its collections — `collectionIds` is simply left out of the payload, which the update
 * contract already reads as "leave them alone".
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
                if (cause.name !== "AbortError") setFailed(true);
            });

        return () => controller.abort();
    }, []);

    return { options, failed, isLoading: options === null && !failed };
}
