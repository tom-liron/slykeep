"use client";

import { useEffect, useState } from "react";

import type { ItemDetailViewModel } from "@/types/view-models";

/**
 * The parts of an item the card it was opened from could not show.
 *
 * List queries never select an item body, so the content, the collections holding it, and its
 * creation date are the parts that have to be waited for; everything else is already on screen from
 * the summary. That split is what makes the drawer's open feel immediate rather than a spinner over
 * an empty panel, and it is why this returns `null` rather than a loading flag — the caller renders
 * the summary meanwhile.
 *
 * `setDetail` is returned because two things write it after the fetch: a saved edit, and an accepted
 * prompt rewrite. Both already hold the updated model the action handed back, so re-fetching to see
 * their own write would be a round trip for something they have.
 */
export function useItemDetail(itemId: string) {
    const [detail, setDetail] = useState<ItemDetailViewModel | null>(null);
    const [error, setError] = useState("");

    useEffect(() => {
        // Aborted on unmount, so a slow response for a previously opened item cannot land in the
        // drawer that replaced it. The caller keys this component by item id, which is also what
        // clears `detail` between items — resetting it here would be a synchronous setState in an
        // effect, and a cascading render the compiler rightly rejects.
        const controller = new AbortController();

        fetch(`/api/items/${itemId}`, { signal: controller.signal })
            .then(async (response) => {
                if (!response.ok) {
                    throw new Error(
                        response.status === 404
                            ? "This item no longer exists."
                            : "Could not load this item.",
                    );
                }
                return (await response.json()) as ItemDetailViewModel;
            })
            .then(setDetail)
            .catch((cause: Error) => {
                if (cause.name !== "AbortError") {
                    setError(cause.message || "Could not load this item.");
                }
            });

        return () => controller.abort();
    }, [itemId]);

    return { detail, setDetail, error };
}
