import { describe, expect, it } from "vitest";

import { formatDate, getFirstName, getInitials } from "./format";

describe("format helpers", () => {
    it("formats date-only strings consistently in UTC", () => {
        expect(formatDate("2026-01-15")).toBe("Jan 15");
    });

    it("formats the serialized timestamps view models carry", () => {
        expect(formatDate(new Date("2026-01-15T00:00:00Z").toISOString())).toBe("Jan 15");
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
