import { describe, expect, it } from "vitest";

import {
    DEFAULT_SIGN_IN_DESTINATION,
    resolveCallbackUrl,
    signInDestination,
} from "./auth-redirects";

/**
 * `resolveCallbackUrl` is the only thing between a query parameter and a post-authentication
 * redirect, so the cases that matter are the ones that try to leave the site. Everything it lets
 * through is handed to `redirectTo` without further inspection.
 */

describe("resolveCallbackUrl", () => {
    it("accepts a relative path", () => {
        expect(resolveCallbackUrl("/collections/abc123")).toBe("/collections/abc123");
    });

    it("keeps the query string, which is part of where they were going", () => {
        expect(resolveCallbackUrl("/items/snippets?sort=recent")).toBe(
            "/items/snippets?sort=recent",
        );
    });

    describe("refuses anything that leaves the site", () => {
        // Each of these is an open redirect if honoured: the user authenticates on a site they
        // trust and is then handed to somewhere they did not choose, with the sign-in page's
        // credibility behind it.
        it.each([
            ["an absolute URL", "https://evil.example/phish"],
            ["a scheme-only absolute", "http://evil.example"],
            ["a protocol-relative URL", "//evil.example"],
            ["a backslash protocol-relative URL", "/\\evil.example"],
            ["a bare path with no leading slash", "collections"],
            ["a javascript: URL", "javascript:alert(1)"],
        ])("%s", (_label, value) => {
            expect(resolveCallbackUrl(value)).toBeNull();
        });
    });

    describe("refuses the auth pages, which would loop", () => {
        it.each(["/sign-in", "/register", "/forgot-password", "/reset-password"])("%s", (route) => {
            expect(resolveCallbackUrl(route)).toBeNull();
        });

        // The path is what decides, not the whole string — a query would otherwise slip one past.
        it("including with a query string attached", () => {
            expect(resolveCallbackUrl("/sign-in?error=x")).toBeNull();
        });
    });

    it("refuses a duplicated param, which arrives as an array", () => {
        expect(resolveCallbackUrl(["/a", "/b"])).toBeNull();
    });

    it("refuses a missing value", () => {
        expect(resolveCallbackUrl(undefined)).toBeNull();
        expect(resolveCallbackUrl(null)).toBeNull();
        expect(resolveCallbackUrl("")).toBeNull();
    });
});

describe("signInDestination", () => {
    it("returns to the callback when there is one", () => {
        expect(signInDestination("/collections/abc123")).toBe("/collections/abc123");
    });

    // The flag is only meaningful on the dashboard home, where `WelcomeToast` is rendered.
    it("falls back to the dashboard, with the welcome flag", () => {
        expect(signInDestination(null)).toBe(DEFAULT_SIGN_IN_DESTINATION);
        expect(DEFAULT_SIGN_IN_DESTINATION).toContain("welcome=signed-in");
    });

    it("does not attach the welcome flag to a callback", () => {
        expect(signInDestination("/collections/abc123")).not.toContain("welcome");
    });
});
