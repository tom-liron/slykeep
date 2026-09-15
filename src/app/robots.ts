import type { MetadataRoute } from "next";

import { appOrigin } from "@/server/infra/app-origin";

/**
 * Crawler rules for the public site, served by Next at `/robots.txt`.
 *
 * Search engines and the security crawlers behind company web filters read this first. It opens the
 * site to them, keeps them out of the API, and points them at the sitemap built by `app/sitemap.ts`.
 * The proxy matcher excludes the path, so crawlers receive this file rather than a sign-in redirect.
 */

/**
 * Builds the `/robots.txt` rules.
 *
 * @remarks
 * Private routes are not listed under `disallow`: the proxy already redirects a visitor without a
 * session away from them, and listing them would publish the app's route map.
 */
export default function robots(): MetadataRoute.Robots {
    return {
        rules: { userAgent: "*", allow: "/", disallow: "/api/" },
        sitemap: `${appOrigin()}/sitemap.xml`,
    };
}
