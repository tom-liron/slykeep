import { describe, expect, it } from "vitest";

import { parseVerificationOutcome } from "./verification-outcomes";

/**
 * `parseVerificationOutcome` stands between a query parameter and the message a person reads after
 * clicking a link from their inbox, so the cases that matter are the ones that are not a status the
 * route handler wrote. Every one of them has to fail closed onto the dead-link message rather than
 * render an empty card or claim a confirmation that never happened.
 */

describe("parseVerificationOutcome", () => {
    it.each(["verified", "already-verified", "expired", "invalid"])(
        "passes %s through",
        (status) => {
            expect(parseVerificationOutcome(status)).toBe(status);
        },
    );

    describe("falls back to invalid", () => {
        it.each([
            ["a status that is not one of ours", "confirmed"],
            ["an empty string", ""],
            ["a near miss in casing", "Verified"],
            ["a near miss in spacing", " verified"],
        ])("%s", (_label, value) => {
            expect(parseVerificationOutcome(value)).toBe("invalid");
        });

        // The page can be opened directly, and a duplicated param (`?status=a&status=b`) arrives as
        // an array with no sound way to choose between the two.
        it("a missing value", () => {
            expect(parseVerificationOutcome(undefined)).toBe("invalid");
            expect(parseVerificationOutcome(null)).toBe("invalid");
        });

        it("a duplicated param, which arrives as an array", () => {
            expect(parseVerificationOutcome(["verified", "expired"])).toBe("invalid");
        });
    });
});
