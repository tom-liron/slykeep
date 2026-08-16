"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Whether the primary pointer is a finger rather than a mouse.
 *
 * The same test the `pointer-coarse:` Tailwind variant compiles to, asked from JavaScript because
 * some decisions cannot be made in CSS: which editor to render at all is one, and a stylesheet
 * cannot stop monaco from fetching several megabytes off a CDN for a surface it is about to hide.
 *
 * Not a width breakpoint, for the reason the touch-target work settled on: a touch laptop at 1440px
 * has a finger on it and a mouse at 390px does not.
 *
 * `useSyncExternalStore` rather than `useState` in an effect — the React Compiler rejects that shape
 * (`set-state-in-effect`), and this is what it is for. The server snapshot is `false`, so SSR and
 * first paint agree on the mouse case and a phone corrects itself on hydration; the alternative is
 * rendering nothing until mounted, which costs every desktop a layout shift to spare phones one.
 */
const COARSE_POINTER = "(pointer: coarse)";

export function useCoarsePointer(): boolean {
    const subscribe = useCallback((onStoreChange: () => void) => {
        const query = window.matchMedia(COARSE_POINTER);

        query.addEventListener("change", onStoreChange);

        return () => query.removeEventListener("change", onStoreChange);
    }, []);

    return useSyncExternalStore(
        subscribe,
        () => window.matchMedia(COARSE_POINTER).matches,
        () => false,
    );
}
