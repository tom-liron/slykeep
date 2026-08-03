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

/** Initials from a name, e.g. "John Doe" → "JD" (max two letters, uppercased). */
export function getInitials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);

    return parts
        .map((part) => part.charAt(0))
        .join("")
        .slice(0, 2)
        .toUpperCase();
}
