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
});
