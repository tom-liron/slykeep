import type { BillingCycle } from "./marketing";

/**
 * The mapping between this application's billing vocabulary and Stripe's.
 *
 * Stripe identifies a subscription by Price id and status; the application speaks in cycles
 * ({@link BillingCycle}) and a single `isPro` flag. This module translates in both directions:
 * `actions/billing.ts` turns the cycle a user picked into the Price that checkout charges, and
 * `server/billing.ts` turns the Price and status arriving on a Stripe webhook into the cycle shown
 * in the billing panel and the entitlement written to the user row.
 *
 * A new Price, a new cycle, or a change to what counts as a paying subscription starts here.
 *
 * @remarks
 * The prices a visitor *reads* are copy in `config/marketing.ts`, beside {@link BillingCycle}, and
 * are not fetched from Stripe.
 */

/**
 * Resolves the Stripe Price id that a billing cycle checks out against.
 *
 * @throws When the cycle's `STRIPE_PRICE_ID_*` variable is unset.
 * @remarks
 * The environment is read inside the function rather than at module scope: `next build` evaluates
 * server modules while collecting page data, so a top-level read that throws would fail the build
 * on a machine holding only the public configuration.
 */
export function priceIdFor(cycle: BillingCycle): string {
    const id =
        cycle === "yearly"
            ? process.env.STRIPE_PRICE_ID_YEARLY
            : process.env.STRIPE_PRICE_ID_MONTHLY;

    if (!id) {
        throw new Error(
            `Stripe is not configured — set STRIPE_PRICE_ID_${cycle === "yearly" ? "YEARLY" : "MONTHLY"}.`,
        );
    }

    return id;
}

/**
 * The inverse of {@link priceIdFor}, for the webhook and the billing panel: which cycle a Price id
 * represents.
 *
 * @returns `null` for an unconfigured or unrecognized id, rather than throwing. This runs while
 * handling an event Stripe has already sent, where a subscription that cannot be labelled is not a
 * reason to fail delivery and have the event retried for days.
 */
export function cycleForPriceId(priceId: string | null | undefined): BillingCycle | null {
    if (!priceId) return null;
    if (priceId === process.env.STRIPE_PRICE_ID_MONTHLY) return "monthly";
    if (priceId === process.env.STRIPE_PRICE_ID_YEARLY) return "yearly";
    return null;
}

/**
 * The Stripe subscription statuses that entitle an account to Pro.
 *
 * `syncSubscriptionState` takes the account's most recent subscription in one of these statuses and
 * writes `isPro` from it.
 *
 * @remarks
 * `past_due` entitles. Stripe does not cancel on a failed payment — it retries for roughly three
 * weeks before moving the subscription to `canceled`, which is not in this set, so access ends when
 * Stripe gives up and the grace period needs no code of its own.
 */
export const ENTITLING_STATUSES: ReadonlySet<string> = new Set(["active", "trialing", "past_due"]);
