"use server";

import { redirect } from "next/navigation";

import { priceIdFor } from "@/config/billing";
import type { BillingCycle } from "@/config/marketing";
import { checkRateLimit } from "@/lib/rate-limit";
import { billingOrigin, stripe } from "@/lib/stripe";
import { getOrCreateCustomerId } from "@/server/billing";
import { getCurrentUserId } from "@/server/current-user";
import type { BillingActionResult } from "@/types/billing";

/**
 * The two user-initiated billing flows.
 *
 * Server Actions by `project-overview.md` §9's rule — "a Server Action when the caller only needs
 * success or a message, a route handler when it needs to read an HTTP status". Neither needs a
 * status: the success path is a `redirect()` the action performs itself, and the failure path is a
 * string for a toast. The webhook is the route handler, because its caller is Stripe.
 *
 * Both are reachable only with a session, so `getCurrentUserId` identifies the account and no
 * payload may name the user it acts on.
 */

/**
 * Opens Stripe-hosted Checkout for the chosen cycle.
 *
 * **The cycle is the only thing the payload is trusted with**, and it is mapped to a Price id here
 * rather than accepted as one — the same rule `createItem` follows for item types. A payload naming
 * a price directly would let a caller check out against any price in the account, including a $0
 * one they found in a URL somewhere.
 *
 * Redirects rather than returning a URL: `redirect()` throws, so anything after it is unreachable
 * and the caller needs no navigation code. The return type covers the failure paths only.
 */
export async function startCheckout(cycle: BillingCycle): Promise<BillingActionResult> {
    const userId = await getCurrentUserId();

    // A Checkout Session is a Stripe API call and possibly a Customer row, on a path behind the
    // session — so this bounds cost rather than anonymity, exactly like `upload`.
    const limit = await checkRateLimit("checkout", userId);

    if (!limit.success) {
        return { success: false, error: "Too many attempts. Try again in a few minutes." };
    }

    let url: string | null = null;

    try {
        const customerId = await getOrCreateCustomerId();

        const session = await stripe().checkout.sessions.create({
            mode: "subscription",
            customer: customerId,
            line_items: [{ price: priceIdFor(cycle), quantity: 1 }],
            // Belt and braces beside the customer id: the webhook finds the user by customer, but
            // these make a session traceable from the dashboard without a database lookup.
            client_reference_id: userId,
            subscription_data: { metadata: { userId } },
            success_url: `${billingOrigin()}/settings?checkout=success`,
            cancel_url: `${billingOrigin()}/settings?checkout=cancelled`,
            allow_promotion_codes: true,
        });

        url = session.url;
    } catch (error) {
        console.error("Stripe checkout session failed:", error);

        return { success: false, error: "Could not start checkout. Try again." };
    }

    if (!url) return { success: false, error: "Could not start checkout. Try again." };

    // Outside the try: `redirect()` works by throwing, and a catch would swallow it and report a
    // failure for a session that was created successfully. The same shape `deleteAccount` documents
    // for `signOut`.
    redirect(url);
}

/**
 * Opens the Stripe-hosted billing portal: change card, switch plan, cancel, download invoices.
 *
 * All of that is Stripe's UI rather than ours by choice — every one of those flows has edge cases
 * (proration, dunning, tax) that are not this product's problem to solve. It is also where the
 * cancellation for account deletion happens, which is why `DeleteAccountDialog` calls this action
 * too rather than duplicating the flow.
 */
export async function openBillingPortal(): Promise<BillingActionResult> {
    // Not for an id this function needs, but for the session check itself: this must be
    // unreachable signed out, and `getOrCreateCustomerId` resolves the customer from the session
    // rather than from anything the caller sends.
    await getCurrentUserId();

    let url: string | null = null;

    try {
        const customerId = await getOrCreateCustomerId();

        const session = await stripe().billingPortal.sessions.create({
            customer: customerId,
            return_url: `${billingOrigin()}/settings`,
        });

        url = session.url;
    } catch (error) {
        console.error("Stripe billing portal session failed:", error);

        return { success: false, error: "Could not open billing. Try again." };
    }

    redirect(url);
}
