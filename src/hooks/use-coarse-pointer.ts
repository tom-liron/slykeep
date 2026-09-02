"use client";

import { useMediaQuery } from "./use-media-query";

/**
 * Whether the primary pointer is a finger rather than a mouse.
 *
 * The same test the `pointer-coarse:` Tailwind variant compiles to, asked from JavaScript because
 * which editor to render at all is a decision CSS cannot make — see `useMediaQuery`.
 *
 * Not a width breakpoint: a touch laptop at 1440px has a finger on it and a mouse at 390px does not,
 * and what the editors need to know is whether the input is a finger. That is genuinely a different
 * question from how much room there is, which is why `FilePreview` asks about width instead — an
 * iPad has a coarse pointer and ample room for a page.
 */
const COARSE_POINTER = "(pointer: coarse)";

export function useCoarsePointer(): boolean {
    return useMediaQuery(COARSE_POINTER);
}
