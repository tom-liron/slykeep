"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { priceIdFor } from "@/config/billing";
import type { BillingCycle } from "@/config/marketing";
import { appOrigin } from "@/lib/app-origin";
import { checkRateLimit } from "@/lib/rate-limit";
import { stripe } from "@/lib/stripe";
import { getOrCreateCustomerId } from "@/server/billing";
import { getCurrentUserId } from "@/server/current-user";
import type { BillingActionResult } from "@/types/billing";

/**
 * The two user-initiated billing flows: opening Stripe Checkout, and opening the customer portal.
 *
 * The application's write-side boundary with Stripe. The plan cards on `/upgrade` and the settings
 * billing panel call these; each resolves the account's Stripe customer through
 * `getOrCreateCustomerId` in `server/billing.ts`, creates a hosted session, and redirects to it.
 * Everything that happens afterwards comes back through `api/webhook/stripe`, which is a route
 * handler because its caller is Stripe.
 *
 * @remarks
 * Server Actions rather than routes because neither caller needs an HTTP status: the success path is
 * a `redirect()` the action performs itself, and the failure path is a string for a toast — which is
 * why {@link BillingActionResult} declares a failure arm only. Both are reachable only with a
 * session, so no payload may name the user it acts on.
 */

/**
 * The cycle the checkout payload may name.
 *
 * @remarks
 * `satisfies` rather than a bare `z.enum`, so the two cannot drift: if {@link BillingCycle} grows a
 * third member and this list does not, the assertion fails at compile time rather than the new cycle
 * being refused at runtime by an action nobody thought to update.
 */
const billingCycleSchema = z.enum(["monthly", "yearly"]) satisfies z.ZodType<BillingCycle>;

/**
 * Opens Stripe-hosted Checkout for the chosen cycle, redirecting the browser to it.
 *
 * @remarks
 * The cycle is the only thing the payload is trusted with, and it is mapped to a Price id here
 * rather than accepted as one — the rule `createItem` follows for item types. A payload naming a
 * price directly would let a caller check out against any price in the account, including a $0 one.
 *
 * `redirect()` throws, so nothing after it is reachable and the caller needs no navigation code.
 */
export async function startCheckout(input: BillingCycle): Promise<BillingActionResult> {
    const userId = await getCurrentUserId();

    // A Server Action is a callable endpoint and `BillingCycle` is erased at runtime, so the
    // parameter's type is a statement about this application's own callers rather than about what
    // arrives. Parsing turns a silent fallback into a refusal, which is what matters if a third
    // cycle is added and one call site is missed.
    const parsed = billingCycleSchema.safeParse(input);

    if (!parsed.success) {
        return { success: false, error: "Choose a billing cycle." };
    }

    const cycle = parsed.data;

    // A Checkout Session is a Stripe API call and possibly a Customer row, on a path behind the
    // session — so this bounds cost rather than anonymity, like the upload route.
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
            // Beside the customer id: the webhook finds the user by customer, but these make a
            // session traceable from the Stripe dashboard without a database lookup.
            client_reference_id: userId,
            subscription_data: { metadata: { userId } },
            success_url: `${appOrigin()}/settings?checkout=success`,
            cancel_url: `${appOrigin()}/settings?checkout=cancelled`,
            allow_promotion_codes: true,
        });

        url = session.url;
    } catch (error) {
        console.error("Stripe checkout session failed:", error);

        return { success: false, error: "Could not start checkout. Try again." };
    }

    if (!url) return { success: false, error: "Could not start checkout. Try again." };

    // Outside the try: `redirect()` works by throwing, and a catch would swallow it and report a
    // failure for a session that was created successfully.
    redirect(url);
}

/**
 * Opens the Stripe-hosted billing portal: change card, switch plan, cancel, download invoices.
 *
 * @remarks
 * All of those are Stripe's UI rather than this application's, because each has edge cases —
 * proration, dunning, tax — that are not this product's to solve. It is also where the cancellation
 * that unblocks account deletion happens, which is why `DeleteAccountDialog` calls this action
 * rather than duplicating the flow.
 */
export async function openBillingPortal(): Promise<BillingActionResult> {
    // Called for the session check alone — the id is discarded. This action must be unreachable
    // signed out, and `getOrCreateCustomerId` below resolves the customer from the session rather
    // than from anything the caller sends, so nothing else here would have rejected a stranger.
    await getCurrentUserId();

    let url: string | null = null;

    try {
        const customerId = await getOrCreateCustomerId();

        const session = await stripe().billingPortal.sessions.create({
            customer: customerId,
            return_url: `${appOrigin()}/settings`,
        });

        url = session.url;
    } catch (error) {
        console.error("Stripe billing portal session failed:", error);

        return { success: false, error: "Could not open billing. Try again." };
    }

    redirect(url);
}
