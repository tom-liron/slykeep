import { describe, expect, it } from "vitest";

import { paletteShortcutLabel } from "./keyboard-shortcut";

/**
 * The platform rule behind the command palette's shortcut hint: Command on Apple devices, Control
 * everywhere else.
 */
describe("paletteShortcutLabel", () => {
    it.each(["MacIntel", "macOS", "iPhone", "iPad"])("names Command on %s", (platform) => {
        expect(paletteShortcutLabel(platform)).toBe("⌘K");
    });

    it.each(["Win32", "Windows", "Linux x86_64", "Android", "Chrome OS", ""])(
        "names Control on %j",
        (platform) => {
            expect(paletteShortcutLabel(platform)).toBe("Ctrl K");
        },
    );
});
