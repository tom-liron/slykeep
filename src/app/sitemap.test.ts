import { afterEach, describe, expect, it, vi } from "vitest";

import { OPEN_ROUTES, SIGNED_OUT_ROUTES } from "@/lib/auth-redirects";
import sitemap from "./sitemap";

/**
 * The sitemap is read by crawlers that carry no session, so a listed path the proxy protects would
 * hand them a redirect to `/sign-in` instead of a page. Each path is checked against the same public
 * route sets the proxy reads.
 */

describe("sitemap", () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it("builds absolute URLs on the deployment's origin", () => {
        vi.stubEnv("AUTH_URL", "https://example.com/");

        for (const { url } of sitemap()) {
            expect(url.startsWith("https://example.com/")).toBe(true);
            expect(url).not.toContain("example.com//");
        }
    });

    it("lists only paths a visitor without a session can open", () => {
        vi.stubEnv("AUTH_URL", "https://example.com");

        for (const { url } of sitemap()) {
            const { pathname } = new URL(url);
            // `/` is public through the proxy's rewrite to the landing page, not through the sets.
            const isPublic =
                pathname === "/" || OPEN_ROUTES.has(pathname) || SIGNED_OUT_ROUTES.has(pathname);

            expect(isPublic, pathname).toBe(true);
        }
    });
});
