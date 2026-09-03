"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * A CSS media query as React state.
 *
 * The escape hatch for the cases where a stylesheet is not enough. CSS can hide an element, but it
 * cannot stop the browser building it first — several megabytes of monaco for an editor, or a whole
 * document fetched into a frame for a PDF embed. Where the decision is *which element exists*, it
 * has to be made in JavaScript, and this is where. Where it is only how an element looks, it belongs
 * in a class instead.
 *
 * Used by `useCoarsePointer` (which editor surface to mount) and directly by `FilePreview` (which
 * viewer a file opens in).
 */

/**
 * Subscribes to a media query and returns whether it currently matches.
 *
 * @param query - Raw media-query text, as `matchMedia` takes it.
 *
 * @remarks
 * The server snapshot is `false`, so SSR and first paint agree on the non-matching case and the
 * client corrects itself on hydration. Write queries so that `false` is the safe answer.
 *
 * `useSyncExternalStore` rather than `useState` in an effect: the React Compiler rejects that shape
 * (`set-state-in-effect`), and a subscription is what this is.
 */
export function useMediaQuery(query: string): boolean {
    const subscribe = useCallback(
        (onStoreChange: () => void) => {
            const list = window.matchMedia(query);

            list.addEventListener("change", onStoreChange);

            return () => list.removeEventListener("change", onStoreChange);
        },
        [query],
    );

    return useSyncExternalStore(
        subscribe,
        () => window.matchMedia(query).matches,
        () => false,
    );
}
