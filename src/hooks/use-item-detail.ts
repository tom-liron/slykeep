"use client";

import { useEffect, useState } from "react";

import type { ItemDetailViewModel } from "@/types/view-models";

/**
 * Loads the parts of an item that the card it was opened from could not carry.
 *
 * `ItemDrawer` opens on the summary view model it was clicked with and renders the title,
 * tags and type immediately; this hook fetches the rest from `GET /api/items/[id]`, which authorizes
 * the request and returns an {@link ItemDetailViewModel}. The body, the collections holding the
 * item and its creation date are what have to be waited for, because list queries never select an
 * item body.
 */

/**
 * Fetches one item's detail, re-fetching whenever the id changes.
 *
 * @returns `detail` is `null` until the fetch lands rather than being paired with a loading flag —
 * the caller renders the summary meanwhile — and `setDetail` lets the two things that already hold a
 * fresh model write it without a second round trip: a saved edit, and an accepted prompt rewrite.
 */
export function useItemDetail(itemId: string) {
    const [detail, setDetail] = useState<ItemDetailViewModel | null>(null);
    const [error, setError] = useState("");

    useEffect(() => {
        // Aborted on unmount, so a slow response for a previously opened item cannot land in the
        // drawer that replaced it. The caller keys this component by item id, which is also what
        // clears `detail` between items — resetting it here would be a setState in an effect, and a
        // cascading render the compiler rejects.
        const controller = new AbortController();

        fetch(`/api/items/${itemId}`, { signal: controller.signal })
            .then(async (response) => {
                if (!response.ok) {
                    // 404 is the item having been deleted elsewhere, which is worth saying; every
                    // other status is retryable and says so.
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
