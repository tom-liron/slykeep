import { describe, expect, it } from "vitest";

import { formatDate, formatLongDate, getFirstName, getInitials } from "./format";

describe("format helpers", () => {
    it("formats date-only strings consistently in UTC", () => {
        expect(formatDate("2026-01-15")).toBe("Jan 15");
    });

    it("formats the serialized timestamps view models carry", () => {
        expect(formatDate(new Date("2026-01-15T00:00:00Z").toISOString())).toBe("Jan 15");
    });

    it("includes the year in a long date, which a join date usually needs", () => {
        expect(formatLongDate("2026-01-15T00:00:00.000Z")).toBe("January 15, 2026");
    });

    it("keeps a long date in UTC rather than shifting it across a day boundary", () => {
        // Late-evening UTC is already the next day in eastern zones and the same day in western
        // ones. Pinning to UTC is what keeps a join date from reading differently per viewer.
        expect(formatLongDate("2026-01-15T23:30:00.000Z")).toBe("January 15, 2026");
    });

    it("normalizes whitespace when generating initials", () => {
        expect(getInitials("  John   Doe  ")).toBe("JD");
    });

    it("handles empty names", () => {
        expect(getInitials("   ")).toBe("");
    });

    it("takes the first word as the greeting name", () => {
        expect(getFirstName("  John   Doe  ")).toBe("John");
    });

    it("reduces the email fallback to its local part", () => {
        // `buildUserViewModel` uses the email as the name when the account has none, so this is
        // the difference between "Welcome back, John!" and "Welcome back, john@example.com!".
        expect(getFirstName("john@example.com")).toBe("john");
    });

    it("handles empty names", () => {
        expect(getFirstName("   ")).toBe("");
    });
});
