"use client";

import { useEffect, useRef, useState } from "react";

import { copyToClipboard } from "@/lib/clipboard";

/**
 * Runs a copy control's click and holds the "Copied" state its button shows afterwards.
 *
 * A copy is confirmed on the button that was pressed — the icon becomes a check for a moment —
 * rather than by a toast, because the confirmation belongs where the user is already looking. Both
 * copy controls in the app use this hook: `CopyItemButton` on the item cards, and the drawer
 * toolbar's Copy through `ItemDrawer`. The write itself, and the toast for a copy that fails, stay
 * in {@link copyToClipboard}.
 */

/** How long the button stays in its copied state before returning to the copy icon. */
const COPIED_FEEDBACK_MS = 2000;

/**
 * Provides a copy handler plus the two flags a copy button renders from.
 *
 * `copy` takes the text, or a promise of it for a body that has to be fetched first; passing the
 * pending promise through is what keeps Safari's clipboard write inside the user gesture, so it
 * must not be awaited before it gets here. `isCopying` disables the button for the round trip, and
 * `isCopied` drives the check-and-"Copied" swap for {@link COPIED_FEEDBACK_MS} afterwards.
 *
 * @remarks
 * Repeated clicks restart the window rather than stacking anything: this is the mechanism that
 * replaced the copy toast, which is why no copy control shows a success toast any more.
 */
export function useCopyAction() {
    const [isCopying, setIsCopying] = useState(false);
    const [isCopied, setIsCopied] = useState(false);
    const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // A card unmounts on the next list refresh, and the drawer unmounts on close; either can happen
    // inside the confirmation window.
    useEffect(() => {
        return () => {
            if (resetTimer.current) clearTimeout(resetTimer.current);
        };
    }, []);

    const copy = async (text: string | Promise<string>) => {
        setIsCopying(true);

        const copied = await copyToClipboard(text);

        setIsCopying(false);

        if (resetTimer.current) clearTimeout(resetTimer.current);

        // A failure has raised its own toast, and the check must not claim otherwise.
        if (!copied) {
            setIsCopied(false);
            return;
        }

        setIsCopied(true);
        resetTimer.current = setTimeout(() => setIsCopied(false), COPIED_FEEDBACK_MS);
    };

    return { copy, isCopying, isCopied };
}
