/** Format an ISO 8601 date or timestamp as e.g. "Jan 15", always in UTC. */
export function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
    });
}

/**
 * Format an ISO 8601 date or timestamp as e.g. "January 15, 2026", always in UTC.
 *
 * Separate from `formatDate` because that one omits the year, which is right for a card showing
 * something touched recently and wrong for a join date that is usually not from this year.
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
 * `UserViewModel.name` falls back to the email address when the account has no name — every
 * OAuth-less registration that skipped it — so "Welcome back, john@example.com!" is a real
 * possibility. Addresses are reduced to their local part instead.
 */
export function getFirstName(name: string): string {
    const first = name.trim().split(/\s+/).filter(Boolean)[0] ?? "";

    return first.includes("@") ? first.split("@")[0] : first;
}

/**
 * A byte count as e.g. "12 KB" or "1.4 MB".
 *
 * Binary units (1024), which is what every file manager a developer has open reports, and one
 * decimal place only above a kilobyte — "1.4 MB" is useful, "1,468,006 bytes" and "1.400391 MB" are
 * both noise on a card.
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

    // Whole numbers keep no decimal: "5 MB", not "5.0 MB".
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
