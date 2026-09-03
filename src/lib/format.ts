/**
 * Display formatting for dates, byte counts and names.
 *
 * Presentational helpers used across the dashboard — cards, rows, the profile page, the billing
 * panel, the avatar. View models serialize dates to ISO strings and leave formatting to the
 * surface, which is where these come in. All date output is UTC, so a row reads the same wherever it
 * is opened from.
 */

/** Formats an ISO 8601 date or timestamp as e.g. "Jan 15" — month and day, UTC. */
export function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
    });
}

/**
 * Formats an ISO 8601 date or timestamp as e.g. "January 15, 2026" — with the year, UTC.
 *
 * For dates where the year carries information, such as an account's join date. {@link formatDate}
 * drops the year, which suits a card showing recent activity.
 */
export function formatLongDate(iso: string): string {
    return new Date(iso).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: "UTC",
    });
}

/**
 * The name to greet someone by, e.g. "John Doe" → "John".
 *
 * `UserViewModel.name` falls back to the email address when the account has no name, so the greeting
 * can be handed an address. An address is reduced to its local part rather than shown whole.
 */
export function getFirstName(name: string): string {
    const first = name.trim().split(/\s+/).filter(Boolean)[0] ?? "";

    return first.includes("@") ? first.split("@")[0] : first;
}

/**
 * A byte count as e.g. "12 KB" or "1.4 MB".
 *
 * Binary units (1024 per step), matching what a file manager reports. One decimal place above a
 * kilobyte; a whole number prints without one ("5 MB", not "5.0 MB").
 */
export function formatFileSize(bytes: number): string {
    if (bytes < 1024) {
        return `${bytes} B`;
    }

    const units = ["KB", "MB", "GB"];
    let size = bytes / 1024;
    let unit = 0;

    while (size >= 1024 && unit < units.length - 1) {
        size /= 1024;
        unit += 1;
    }

    // One decimal place; `Math.round` drops a trailing ".0" on its own.
    const rounded = Math.round(size * 10) / 10;

    return `${rounded} ${units[unit]}`;
}

/** Initials from a name, e.g. "John Doe" → "JD" (max two letters, uppercased). */
export function getInitials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);

    return parts
        .map((part) => part.charAt(0))
        .join("")
        .slice(0, 2)
        .toUpperCase();
}
