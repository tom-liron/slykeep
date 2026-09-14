"use client";

import { useSyncExternalStore } from "react";

import { paletteShortcutLabel } from "@/lib/keyboard-shortcut";

/**
 * The command-palette shortcut label for the visitor's platform, as React state.
 *
 * `CommandPalette` renders it in the top bar's search field, so a Windows or Linux user is shown
 * Ctrl K rather than a Mac-only key.
 */

/** The platform never changes during a session, so there is nothing to subscribe to. */
const subscribe = () => () => {};

function readPlatform(): string {
    const hinted = navigator as Navigator & { userAgentData?: { platform?: string } };
    return hinted.userAgentData?.platform || navigator.platform;
}

/**
 * Returns "⌘K" on Apple devices and "Ctrl K" elsewhere.
 *
 * @returns `null` while rendering on the server and during hydration, when the platform is not yet
 * known — callers render no hint then, so a Windows user never sees ⌘K flash first.
 */
export function usePaletteShortcutLabel(): string | null {
    return useSyncExternalStore(
        subscribe,
        () => paletteShortcutLabel(readPlatform()),
        () => null,
    );
}
