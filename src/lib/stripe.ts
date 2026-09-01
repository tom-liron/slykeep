import "server-only";

import Stripe from "stripe";

/**
 * The Stripe client.
 *
 * `import "server-only"` despite living in `lib/`, for the reason `rate-limit.ts` and `r2.ts` both
 * state: `lib/` is client-reachable — components import `@/lib/format` and `@/lib/utils` — and the
 * secret key must never reach a bundle the browser can read. The directive turns a mistaken client
 * import into a build error rather than a leak.
 */

/**
 * The API version this integration is written against.
 *
 * Pinned, not inferred. An unpinned client adopts whatever version the Stripe account happens to be
 * defaulted to, which is how a dashboard setting becomes a production incident — the same request
 * starts returning a differently shaped object with no deploy on our side.
 *
 * The value was read off the installed package (`Stripe.LatestApiVersion`, stripe@22.5.0) rather
 * than copied out of the plan document, which by then named an older one. Typing the constant as
 * `Stripe.LatestApiVersion` is what keeps that honest: a package upgrade that moves the version
 * fails the build here, so adopting it becomes a deliberate act with a changelog read attached,
 * instead of something that arrives silently with `npm update`.
 */
const API_VERSION: Stripe.LatestApiVersion = "2026-07-29.dahlia";

/**
 * Built lazily rather than at module load, so importing this module cannot throw. `next build`
 * evaluates server modules while collecting page data, and a top-level construction would make
 * `STRIPE_SECRET_KEY` a build-time requirement — the same reason `r2()` and `resend()` defer
 * theirs.
 */
let client: Stripe | null = null;

export function stripe(): Stripe {
    if (client) return client;

    const key = process.env.STRIPE_SECRET_KEY;

    if (!key) throw new Error("Stripe is not configured — set STRIPE_SECRET_KEY.");

    client = new Stripe(key, {
        apiVersion: API_VERSION,
        appInfo: { name: "DevStash" },
    });

    return client;
}
