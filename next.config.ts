import type { NextConfig } from "next";

/**
 * Next.js build and runtime configuration.
 *
 * Sets the security headers every response carries — Content-Security-Policy, anti-framing and
 * MIME-sniffing protection, referrer and permissions policy — plus the build-time flags this
 * project relies on (React Compiler, disabled dev indicators). Read once by Next itself at build
 * and dev-server startup; no application code imports it.
 */

/**
 * True outside `next build` / `next start`. Read from the environment rather than passed in,
 * because the policy below must be stricter in production than the dev server can run under.
 */
const isDevelopment = process.env.NODE_ENV !== "production";

/**
 * Builds this origin's Content-Security-Policy header value.
 *
 * Every directive reflects a specific thing this application does; nothing here is a general
 * relaxation.
 *
 * - `default-src 'self'` is the floor everything unlisted falls back to, including `frame-src` —
 *   which is what the drawer's PDF iframe needs, since it points at `/api/files/[id]`, same origin.
 * - `object-src 'none'` and `base-uri 'self'` block plugin content and an injected `<base>` tag that
 *   could re-point every relative URL on the page.
 * - `frame-ancestors` is `'none'` everywhere except `/api/files/:path*`, which gets `'self'`. The
 *   drawer's PDF iframe is same-origin and points at that route, and both halves of the framing
 *   handshake must agree: the parent page's permission to frame (`default-src`, above) and the
 *   framed response's own permission to be framed (`frame-ancestors`, here). The exception is
 *   scoped to that one route because a page carries session state and UI — the entire clickjacking
 *   surface — while a file response carries neither.
 * - `form-action` names the two Stripe hosts: checkout and the billing portal redirect off this
 *   origin, so both permitted destinations are pinned even though the calls are programmatic
 *   rather than form submissions.
 * - `img-src` allows GitHub's avatar host, for an OAuth account's profile picture. Every other
 *   image this app renders is its own `/api/files/[id]`.
 * - `script-src 'unsafe-inline'` is required by Next's own injected bootstrap and hydration
 *   scripts. Removing it needs a nonce, which needs the proxy to rewrite every HTML response, and
 *   costs the static rendering of `/welcome`, `/sign-in` and `/register`. `'unsafe-eval'` is
 *   development-only, for React Fast Refresh; production carries neither it nor a websocket in
 *   `connect-src`.
 * - `worker-src` keeps `blob:` because monaco decides for itself whether to wrap its own worker in
 *   a blob, independent of being served from this origin.
 *
 * @param frameAncestors - `'none'` for the default policy, `'self'` for `/api/files/:path*`.
 */
function contentSecurityPolicy(frameAncestors: "'none'" | "'self'"): string {
    return [
        "default-src 'self'",
        "base-uri 'self'",
        "object-src 'none'",
        `frame-ancestors ${frameAncestors}`,
        "form-action 'self' https://checkout.stripe.com https://billing.stripe.com",
        "img-src 'self' data: blob: https://avatars.githubusercontent.com",
        "font-src 'self' data:",
        "style-src 'self' 'unsafe-inline'",
        `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""}`,
        "worker-src 'self' blob:",
        `connect-src 'self'${isDevelopment ? " ws:" : ""}`,
    ].join("; ");
}

const nextConfig: NextConfig = {
    reactCompiler: true,
    devIndicators: false,
    async headers() {
        return [
            {
                source: "/:path*",
                headers: [
                    { key: "Content-Security-Policy", value: contentSecurityPolicy("'none'") },
                    { key: "X-Frame-Options", value: "DENY" },
                    { key: "X-Content-Type-Options", value: "nosniff" },
                    // Sends only the origin to a cross-origin request (Stripe, GitHub's avatar
                    // host), never the full path — `/collections/<id>` and `/items/<slug>` carry
                    // meaning that does not belong in a third party's logs.
                    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
                    // Nothing in this app uses the camera, microphone, geolocation or payment APIs,
                    // so nothing embedded in a page can claim them either.
                    {
                        key: "Permissions-Policy",
                        value: "camera=(), microphone=(), geolocation=(), payment=()",
                    },
                ],
            },
            // Next takes the last matching header when two entries share a path and key, so this
            // overrides only Content-Security-Policy and X-Frame-Options for this route; every
            // other header from the blanket rule above (nosniff, Referrer-Policy, Permissions-Policy)
            // still applies here.
            {
                source: "/api/files/:path*",
                headers: [
                    { key: "Content-Security-Policy", value: contentSecurityPolicy("'self'") },
                    { key: "X-Frame-Options", value: "SAMEORIGIN" },
                ],
            },
        ];
    },
};

export default nextConfig;
