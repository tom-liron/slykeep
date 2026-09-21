import { describe, expect, it } from "vitest";

import { getSignInErrorMessage } from "./auth-errors";

/**
 * The sign-in form's reading of Auth.js `?error=` codes: known codes get a specific explanation, and
 * anything else gets a generic sentence that never echoes the raw code.
 */

describe("getSignInErrorMessage", () => {
    it("returns null when there is no error param", () => {
        expect(getSignInErrorMessage(undefined)).toBeNull();
    });

    it("returns null for an empty param, which no real failure produces", () => {
        expect(getSignInErrorMessage("")).toBeNull();
    });

    it("explains a blocked GitHub sign-in and points at the credentials form", () => {
        const message = getSignInErrorMessage("OAuthAccountNotLinked");

        expect(message).toContain("already has a SlyKeep account with a password");
    });

    it("reports an unmapped code generically rather than rendering it", () => {
        const message = getSignInErrorMessage("SomethingNew");

        expect(message).toBe("Something went wrong signing you in. Try again.");
        expect(message).not.toContain("SomethingNew");
    });

    it("still reports a failure when the param is duplicated into an array", () => {
        expect(getSignInErrorMessage(["AccessDenied", "Verification"])).not.toBeNull();
    });

    // Ours too, set by `GET /api/auth/stale-session`. The generic fallback invites the user to "try
    // again", which is precisely the one thing that cannot work here — the account they were signed
    // in as does not exist any more, so the same credentials will not bring it back.
    it("explains a session cleared because its account is gone", () => {
        const message = getSignInErrorMessage("SessionUserMissing");

        expect(message).toContain("no longer available");
        expect(message).not.toBe("Something went wrong signing you in. Try again.");
    });
});
