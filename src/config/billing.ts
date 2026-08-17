import type { BillingCycle } from "./marketing";

/**
 * Which Stripe Price each billing cycle checks out against.
 *
 * Read through a function rather than a module-level constant, for the reason `lib/r2.ts` and
 * `lib/email.ts` both build their clients lazily: `next build` evaluates server modules while
 * collecting page data, and a top-level read that throws on a missing id would fail the build on
 * any machine holding only the public config.
 *
 * The *display* prices live in `config/marketing.ts` and are deliberately not derived from Stripe.
 * The pricing table is marketing copy on a page a signed-out visitor is served; fetching two Price
 * objects to render it would put a network call on the landing page's critical path to display two
 * numbers that change roughly never.
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
 * The inverse, for the webhook: which cycle a Price id represents. `null` for anything else.
 *
 * Deliberately returns `null` rather than throwing when the ids are unconfigured. This one runs
 * while handling an event Stripe has already sent — an unrecognized price is a subscription we
 * cannot label, not a reason to fail the delivery and have it retried for days.
 */
export function cycleForPriceId(priceId: string | null | undefined): BillingCycle | null {
    if (!priceId) return null;
    if (priceId === process.env.STRIPE_PRICE_ID_MONTHLY) return "monthly";
    if (priceId === process.env.STRIPE_PRICE_ID_YEARLY) return "yearly";
    return null;
}

/**
 * Subscription statuses that entitle an account to Pro.
 *
 * `past_due` is in, deliberately, and it is the one entry that looks like a mistake: it means a
 * payment has failed. Stripe does not cancel on a failed payment — it retries for roughly three
 * weeks, emailing the customer, and only then moves the subscription to `canceled`. Almost all of
 * those failures are an expired card rather than someone leaving, so revoking file uploads the same
 * day punishes a paying customer for something their bank did, which is how a card update becomes a
 * cancellation. The abuse case — killing a card on purpose to buy three free weeks — costs $8.
 *
 * Access still ends; it ends when Stripe gives up, because `canceled` is not in this set. The
 * webhook already syncs that transition, so the grace period needs no code of its own.
 */
export const ENTITLING_STATUSES: ReadonlySet<string> = new Set(["active", "trialing", "past_due"]);
