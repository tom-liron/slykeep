"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Whether a CSS media query currently matches, asked from JavaScript.
 *
 * Some decisions cannot be made in CSS. A stylesheet can hide an element, but it cannot stop the
 * browser having built it first — which for monaco is several megabytes of editor and for a PDF
 * embed is the whole document fetched and rendered into a frame nobody will look at. Where the
 * choice is *which element exists*, it has to be made here; where it is only how one looks, it
 * belongs in a class and not in this hook.
 *
 * `useSyncExternalStore` rather than `useState` in an effect — the React Compiler rejects that shape
 * (`set-state-in-effect`), and this is what it is for. The server snapshot is `false`, so SSR and
 * first paint agree on the non-matching case and the client corrects itself on hydration; the
 * alternative is rendering nothing until mounted, which costs every visitor a layout shift. Write
 * queries so that `false` is the safe answer.
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
