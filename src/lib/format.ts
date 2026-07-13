/** Format an ISO date (yyyy-mm-dd) as e.g. "Jan 15". */
export function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
    });
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
