/**
 * Platform-aware labels for the app's keyboard shortcuts.
 *
 * `CommandPalette` listens for both ⌘K and Ctrl+K; this decides which of the two its hint in the top
 * bar names, from the platform the browser reports. Pure, so the platform rule is unit-tested rather
 * than checked on each operating system.
 */

/** Apple platforms, where the palette's modifier is Command. iPadOS reports itself as `MacIntel`. */
const APPLE_PLATFORM = /mac|iphone|ipad|ipod/i;

/**
 * Whether a reported platform is an Apple device.
 *
 * @param platform - `navigator.userAgentData.platform` where the browser provides it, otherwise
 * `navigator.platform`.
 */
export function isApplePlatform(platform: string): boolean {
    return APPLE_PLATFORM.test(platform);
}

/** The command-palette shortcut as its hint shows it on the given platform. */
export function paletteShortcutLabel(platform: string): string {
    return isApplePlatform(platform) ? "⌘K" : "Ctrl K";
}
