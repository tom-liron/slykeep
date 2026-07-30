import { describe, expect, it } from "vitest";

import { getSignInErrorMessage } from "./auth-errors";

describe("getSignInErrorMessage", () => {
    it("returns null when there is no error param", () => {
        expect(getSignInErrorMessage(undefined)).toBeNull();
    });

    it("returns null for an empty param, which no real failure produces", () => {
        expect(getSignInErrorMessage("")).toBeNull();
    });

    it("explains a blocked GitHub sign-in and points at the credentials form", () => {
        const message = getSignInErrorMessage("OAuthAccountNotLinked");

        expect(message).toContain("already has a DevStash account with a password");
    });

    it("reports an unmapped code generically rather than rendering it", () => {
        const message = getSignInErrorMessage("SomethingNew");

        expect(message).toBe("Something went wrong signing you in. Try again.");
        expect(message).not.toContain("SomethingNew");
    });

    it("still reports a failure when the param is duplicated into an array", () => {
        expect(getSignInErrorMessage(["AccessDenied", "Verification"])).not.toBeNull();
    });

    // Both codes are ours, redirected to to by `GET /api/auth/verify-email`. If either fell through
    // to the generic fallback the user would be told to "try again" with a link that can never
    // work, instead of being pointed at the resend control that actually resolves it.
    it.each(["VerificationExpired", "VerificationInvalid"])(
        "tells a user with a dead %s link to request a new one",
        (code) => {
            const message = getSignInErrorMessage(code);

            expect(message).toContain("new one");
            expect(message).not.toBe("Something went wrong signing you in. Try again.");
        },
    );
});
