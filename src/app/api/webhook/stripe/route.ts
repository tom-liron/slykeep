import { headers } from "next/headers";
import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { stripe } from "@/lib/stripe";
import { syncSubscriptionState } from "@/server/billing";

/**
 * Stripe's subscription lifecycle events.
 *
 * A route handler rather than a Server Action because it is a webhook — named explicitly in
 * `coding-standards.md`'s list of what route handlers are for. The caller is Stripe, not a form.
 *
 * ⚠️ This path MUST stay excluded from `src/proxy.ts`'s matcher. The proxy denies by default, Stripe
 * sends no session cookie, and a redirect to `/sign-in` reads to Stripe as a failed delivery — it
 * retries with backoff for days and eventually disables the endpoint, all without this handler ever
 * running, so nothing is logged on this side either.
 *
 * Node runtime, not edge: the raw body has to survive byte for byte for the signature to verify, and
 * `request.text()` is what gives it. `force-dynamic` because a webhook is never cacheable.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The events acted on.
 *
 * `checkout.session.completed` grants Pro on the way back from checkout. The subscription trio
 * covers everything afterwards — plan switches, cancellations, and the move to `past_due` when a
 * card fails. `invoice.payment_failed` is absent: it changes no entitlement on its own, since the
 * subscription's status is what does, and handling it would duplicate the status transition.
 */
const HANDLED = new Set([
    "checkout.session.completed",
    "customer.subscription.created",
    "customer.subscription.updated",
    "customer.subscription.deleted",
]);

export async function POST(request: Request) {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!secret) {
        console.error("STRIPE_WEBHOOK_SECRET is not set; refusing to process a webhook.");

        // 500 rather than 200: Stripe retries, and an unconfigured deployment that silently
        // acknowledged events would drop every subscription change in the gap.
        return NextResponse.json({ error: "Not configured." }, { status: 500 });
    }

    // The RAW body. `request.json()` would re-serialize it, and a single reordered key or changed
    // byte of whitespace invalidates the signature — which is the single most common way this
    // handler is got wrong.
    const body = await request.text();
    const signature = (await headers()).get("stripe-signature");

    if (!signature) {
        return NextResponse.json({ error: "Missing signature." }, { status: 400 });
    }

    let event: Stripe.Event;

    try {
        // The async variant: it verifies through SubtleCrypto rather than Node's synchronous
        // crypto, so this keeps working unchanged if it ever has to run somewhere without
        // `node:crypto`.
        event = await stripe().webhooks.constructEventAsync(body, signature, secret);
    } catch (error) {
        // The signature is the only authentication this endpoint has — the URL is public and the
        // payload is attacker-controlled until this line passes. 400, and nothing is read.
        console.error("Stripe webhook signature verification failed:", error);

        return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
    }

    if (!HANDLED.has(event.type)) {
        // 200, not an error. An unhandled type is one the endpoint is subscribed to but has no work
        // for, and any other status earns a retry of something that will never be handled.
        return NextResponse.json({ received: true });
    }

    // Every handled event names a customer; only the field's shape differs between them.
    const object = event.data.object as Stripe.Checkout.Session | Stripe.Subscription;
    const customerId = typeof object.customer === "string" ? object.customer : object.customer?.id;

    if (!customerId) {
        console.error(`Stripe webhook ${event.type} carried no customer id.`);

        return NextResponse.json({ received: true });
    }

    try {
        // One code path for all four events. `syncSubscriptionState` reads the truth back from
        // Stripe rather than applying the payload, so a retry, a duplicate, and an out-of-order
        // delivery all converge on the same row state — which is why there is no processed-event
        // table here.
        await syncSubscriptionState(customerId);
    } catch (error) {
        console.error(`Stripe webhook ${event.type} failed:`, error);

        // 500 so Stripe retries. A database blip must not silently cost someone the Pro they paid
        // for, and the sync being idempotent is what makes the retry safe.
        return NextResponse.json({ error: "Handler failed." }, { status: 500 });
    }

    return NextResponse.json({ received: true });
}
