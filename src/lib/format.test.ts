import { describe, expect, it } from "vitest";

import { formatDate, formatFileSize, formatLongDate, getFirstName, getInitials } from "./format";

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

describe("formatFileSize", () => {
    it("reports bytes below a kilobyte", () => {
        expect(formatFileSize(0)).toBe("0 B");
        expect(formatFileSize(1023)).toBe("1023 B");
    });

    it("keeps one decimal, and drops it when the number is whole", () => {
        expect(formatFileSize(1024)).toBe("1 KB");
        expect(formatFileSize(1536)).toBe("1.5 KB");
        expect(formatFileSize(1_468_006)).toBe("1.4 MB");
    });

    it("uses binary units, so the upload limits read as the round numbers they are", () => {
        // The constraints are written as 5 * 1024 * 1024, and the drop zone renders this — "5.2 MB"
        // next to a rule that says 5 MB would read as a contradiction.
        expect(formatFileSize(5 * 1024 * 1024)).toBe("5 MB");
        expect(formatFileSize(10 * 1024 * 1024)).toBe("10 MB");
    });

    it("stops at gigabytes", () => {
        expect(formatFileSize(3 * 1024 ** 3)).toBe("3 GB");
    });
});
