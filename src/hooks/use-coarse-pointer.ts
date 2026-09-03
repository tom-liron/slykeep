"use client";

import { useMediaQuery } from "./use-media-query";

/**
 * Whether the primary pointer is a finger rather than a mouse.
 *
 * The item content editors choose their surface by this rather than by width: `CodeEditor` mounts
 * monaco only for a fine pointer, and `ContentTextarea` takes over for a coarse one, because monaco
 * is not usable for *writing* under a finger. Which component exists is a decision CSS cannot make,
 * which is why the query is asked through {@link useMediaQuery} rather than expressed as a
 * `pointer-coarse:` class.
 *
 * @remarks
 * Pointer type and available room are separate questions, and this hook answers only the first. A
 * touch laptop at 1440px has a finger on it and a mouse at 390px does not, so a width breakpoint
 * would get both wrong. `FilePreview` asks about width instead, because the question it has is how
 * much room a page needs — an iPad has a coarse pointer and ample room.
 */

/** The same test the `pointer-coarse:` Tailwind variant compiles to. */
const COARSE_POINTER = "(pointer: coarse)";

export function useCoarsePointer(): boolean {
    return useMediaQuery(COARSE_POINTER);
}
