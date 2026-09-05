import "server-only";

import Stripe from "stripe";

/**
 * The Stripe client and the API version this integration is pinned to.
 *
 * The billing Server Actions and `POST /api/webhook/stripe` call {@link stripe} to reach the Stripe
 * API — checkout sessions, the customer portal, subscription lookups.
 *
 * @remarks
 * `import "server-only"` so the secret key can never reach a browser bundle; every module in
 * `server/infra/` carries the directive.
 */

/**
 * The Stripe API version this code is written against.
 *
 * Pinned rather than inferred: an unpinned client adopts whatever version the account is defaulted
 * to, so a dashboard setting could change the shape of a response with no deploy on this side.
 * Typed as `Stripe.LatestApiVersion` so a package upgrade that moves the version fails the build
 * here, making the upgrade a deliberate step rather than one that arrives with `npm update`.
 */
const API_VERSION: Stripe.LatestApiVersion = "2026-07-29.dahlia";

/**
 * The client, built on first use so importing this module cannot throw. `next build` evaluates
 * server modules while collecting page data, and a top-level construction would make
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
