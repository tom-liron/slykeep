import type { NextConfig } from "next";

/**
 * Next sets this itself: `next dev` runs as development, `next build` and `next start` as
 * production. It is read here rather than passed in because the policy below has to be *stricter*
 * in production than the dev server can tolerate, and getting that backwards silently is worse than
 * either setting.
 */
const isDevelopment = process.env.NODE_ENV !== "production";

/**
 * What this origin is allowed to load and execute.
 *
 * The layer that was missing. Two findings that reached production without it — an uploaded `.xml`
 * served inline, and monaco arriving from jsdelivr — were both "script we did not write, running as
 * the signed-in user on our origin", and both had to be fixed at their own source because nothing
 * bounded them here. Each is fixed; this is what catches the third one.
 *
 * Directive by directive, since every relaxation below is a specific thing this app does:
 *
 * - `default-src 'self'` — the floor. Everything unlisted falls here, including `frame-src`, which
 *   is what the drawer's PDF iframe needs (it points at `/api/files/[id]`, same origin).
 * - `object-src 'none'`, `base-uri 'self'` — no plugins, and no injected `<base>` that could
 *   re-point every relative URL on the page.
 * - `frame-ancestors 'none'` — the authenticated app may not be framed. `X-Frame-Options` below
 *   says the same thing for anything that predates CSP.
 * - `form-action` names the two Stripe hosts because checkout and the billing portal are redirects
 *   *off* this origin. Belt and braces: the actions are called programmatically rather than by form
 *   submission, so this directive should not apply at all — but a redirect out of a Server Action
 *   POST is close enough to one that pinning the two permitted destinations costs nothing.
 * - `img-src` allows GitHub's avatar host, which is where an OAuth account's picture lives. Every
 *   other image this app shows is its own `/api/files/[id]`.
 * - `script-src 'unsafe-inline'` is the one real compromise, and it is Next's: the framework injects
 *   inline bootstrap and hydration scripts on every page. Removing it means a nonce, which means the
 *   proxy rewriting every HTML response — a bigger change than this batch, and one that costs the
 *   static rendering of `/welcome`, `/sign-in` and `/register`. `'unsafe-eval'` is development-only,
 *   where React Fast Refresh needs it; production gets neither it nor a websocket in `connect-src`.
 * - `worker-src` keeps `blob:` even though monaco is same-origin now: monaco decides for itself
 *   whether to wrap its worker in a blob, and that is not a decision worth pinning from out here.
 */
const contentSecurityPolicy = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self' https://checkout.stripe.com https://billing.stripe.com",
    "img-src 'self' data: blob: https://avatars.githubusercontent.com",
    "font-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""}`,
    "worker-src 'self' blob:",
    `connect-src 'self'${isDevelopment ? " ws:" : ""}`,
].join("; ");

const nextConfig: NextConfig = {
    reactCompiler: true,
    devIndicators: false,
    async headers() {
        return [
            {
                source: "/:path*",
                headers: [
                    { key: "Content-Security-Policy", value: contentSecurityPolicy },
                    { key: "X-Frame-Options", value: "DENY" },
                    { key: "X-Content-Type-Options", value: "nosniff" },
                    // Stripe and GitHub see that a request came from this app, and nothing else.
                    // Every URL here that carries meaning carries it in the path — `/collections/
                    // <id>`, `/items/<slug>` — and none of that belongs in a third party's logs.
                    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
                    // Nothing in this app asks for any of them, so nothing embedded in it should be
                    // able to either.
                    {
                        key: "Permissions-Policy",
                        value: "camera=(), microphone=(), geolocation=(), payment=()",
                    },
                ],
            },
        ];
    },
};

export default nextConfig;
