import type { MetadataRoute } from "next";

import { appOrigin } from "@/server/infra/app-origin";

/**
 * The public site's sitemap, served by Next at `/sitemap.xml`.
 *
 * Lists the pages a visitor can open without an account, for search engines and the security
 * crawlers that `app/robots.ts` points here. Everything else on the domain is the signed-in app.
 * A new public marketing page belongs here as well as in `OPEN_ROUTES` in `lib/auth-redirects.ts`.
 */

/**
 * Builds the `/sitemap.xml` entries as absolute URLs on this deployment's origin.
 *
 * @remarks
 * Every listed path must be reachable without a session; `sitemap.test.ts` checks each one against
 * the proxy's public routes. `/welcome` is left out because the proxy serves the same page at `/`.
 */
export default function sitemap(): MetadataRoute.Sitemap {
    const origin = appOrigin();

    return ["/", "/privacy", "/terms"].map((path) => ({ url: `${origin}${path}` }));
}
