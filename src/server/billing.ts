import "server-only";

import type Stripe from "stripe";

import { ENTITLING_STATUSES, cycleForPriceId } from "@/config/billing";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import type { BillingViewModel } from "@/types/view-models";
import { getCurrentUser } from "./current-user";

/**
 * The application's boundary with Stripe on the read and reconciliation side: an account's customer
 * record, the entitlement sync the webhook drives, the summary the settings panel renders, and the
 * two helpers account deletion needs.
 *
 * `server/` rather than `actions/` because none of this answers a form. `api/webhook/stripe` calls
 * {@link syncSubscriptionState} for every subscription event, the settings page calls
 * {@link getBillingSummary}, and `deleteAccount` in `actions/account.ts` calls
 * {@link hasBillableSubscription} and then {@link endBillingRelationship}. The two user-initiated
 * flows — opening checkout and opening the portal — are Server Actions in `actions/billing.ts`, and
 * both start by calling {@link getOrCreateCustomerId} here.
 *
 * @remarks
 * Entitlement lives in `User.isPro` and the four `stripe*` columns, which this module is the only
 * writer of. Everything else in the app reads those columns; only the deletion gate pays for a live
 * answer from Stripe.
 */

/**
 * This account's Stripe customer id, or null when it has never opened checkout.
 *
 * Private to this module, because the exported functions below are the billing boundary and nothing
 * outside reads the column directly. It exists because three of them begin with the same lookup and
 * the same "no customer, nothing to do" guard — an account that has never opened checkout is the
 * normal case rather than an error, and each caller returns something different for it.
 */
async function customerIdFor(userId: string): Promise<string | null> {
    const row = await prisma.user.findUnique({
        where: { id: userId },
        select: { stripeCustomerId: true },
    });

    return row?.stripeCustomerId ?? null;
}

/**
 * The signed-in account's Stripe customer, created and stored on first use.
 *
 * @remarks
 * A customer is created *before* checkout rather than letting Checkout create one, so the webhook
 * has a stable key to find the user by. `checkout.session.completed` carries metadata, but the later
 * `customer.subscription.updated` and `.deleted` events carry a customer id and nothing else —
 * without a `stripeCustomerId` already on the row, a cancellation months from now has nothing to
 * match against.
 *
 * The email is passed so the Stripe dashboard is legible, and the user id goes in metadata so a
 * customer can be traced back to an account even if the column is lost.
 */
export async function getOrCreateCustomerId(): Promise<string> {
    const user = await getCurrentUser();

    const existing = await customerIdFor(user.id);

    if (existing) return existing;

    const customer = await stripe().customers.create({
        email: user.email,
        name: user.name || undefined,
        metadata: { userId: user.id },
    });

    // Written before checkout is opened, so an abandoned attempt leaves the account linked to one
    // customer rather than minting a new one on every try.
    await prisma.user.update({
        where: { id: user.id },
        data: { stripeCustomerId: customer.id },
    });

    return customer.id;
}

/**
 * Brings the local entitlement columns into line with Stripe, for one customer. Called by the
 * webhook for all four events it handles, and safe to call from anywhere else.
 *
 * @remarks
 * Reads the subscription back from the API rather than trusting the event payload. Webhooks are
 * delivered at least once and in no guaranteed order: an `updated` event can arrive after the
 * `deleted` that superseded it, and a retry of a week-old event can arrive at any time. Deriving
 * state from what Stripe says is true *now* makes both harmless, and makes the handler idempotent by
 * construction — no event log, no processed-id table.
 */
export async function syncSubscriptionState(customerId: string): Promise<void> {
    const subscriptions = await stripe().subscriptions.list({
        customer: customerId,
        status: "all",
        limit: 10,
    });

    // The most recent entitling subscription, if any. `list` returns newest first.
    const active = subscriptions.data.find((subscription) =>
        ENTITLING_STATUSES.has(subscription.status),
    );

    // `current_period_end` lives on the subscription's *items* as of the `2025-03-31.basil` API
    // version. Reading it off the subscription itself yields undefined silently.
    const periodEnd = active?.items.data[0]?.current_period_end;
    const priceId = active?.items.data[0]?.price.id ?? null;

    // Whether that date is an expiry rather than a renewal — what stops the panel promising a
    // renewal to someone who has cancelled and is serving out what they paid for.
    const cancelAtPeriodEnd = active ? endsWithoutRenewing(active) : false;

    await prisma.user.updateMany({
        // `updateMany` rather than `update`: a webhook can name a customer this database has never
        // heard of — one created by hand in the dashboard, or one belonging to a deleted account —
        // and `update` throws P2025 on no match, which would answer Stripe with a 500 and earn an
        // endless retry of an event there is nothing to do about.
        where: { stripeCustomerId: customerId },
        data: {
            isPro: Boolean(active),
            stripeSubscriptionId: active?.id ?? null,
            stripePriceId: priceId,
            // Stripe timestamps are seconds; `Date` takes milliseconds.
            stripeCurrentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
            stripeCancelAtPeriodEnd: cancelAtPeriodEnd,
        },
    });
}

/**
 * What the settings page's billing panel renders.
 *
 * @remarks
 * Built from the local row: these are the columns {@link syncSubscriptionState} keeps in step, and a
 * Stripe round trip on every settings page view to draw a button and a date is not worth it. Only
 * the deletion gate pays for the live answer.
 */
export async function getBillingSummary(): Promise<BillingViewModel> {
    const user = await getCurrentUser();

    const row = await prisma.user.findUnique({
        where: { id: user.id },
        select: {
            stripeCustomerId: true,
            stripePriceId: true,
            stripeCurrentPeriodEnd: true,
            stripeCancelAtPeriodEnd: true,
        },
    });

    return {
        isPro: user.isPro,
        cycle: cycleForPriceId(row?.stripePriceId),
        // Serialized at the server boundary, like every other date in `types/view-models.ts`.
        currentPeriodEnd: row?.stripeCurrentPeriodEnd?.toISOString() ?? null,
        cancelAtPeriodEnd: row?.stripeCancelAtPeriodEnd ?? false,
        hasCustomer: Boolean(row?.stripeCustomerId),
    };
}

/**
 * When a subscription is scheduled to stop, in Stripe's unix seconds, or `null` if it is not.
 *
 * @remarks
 * There are two shapes for this and they are not interchangeable. Setting `cancel_at_period_end:
 * true` through the API leaves `cancel_at` null; the *customer portal* does the opposite — it writes
 * `cancel_at` with the period-end timestamp and leaves `cancel_at_period_end` false. Reading only
 * the flag therefore misses every cancellation a real user makes, since the portal is the only place
 * they can make one.
 */
function scheduledEnd(subscription: Stripe.Subscription): number | null {
    if (subscription.cancel_at_period_end) {
        return subscription.items.data[0]?.current_period_end ?? null;
    }

    return subscription.cancel_at ?? null;
}

/**
 * Whether this subscription runs out at the end of the period it is in, rather than renewing.
 *
 * @remarks
 * The comparison against the current period's end is what makes this narrower than "is a stop
 * scheduled". {@link scheduledEnd} can return a date several periods away, and a subscription that
 * renews twice before stopping *will* bill again meanwhile. Only a stop falling on or before the
 * current period's end means "cancelled, serving out what was paid for".
 */
function endsWithoutRenewing(subscription: Stripe.Subscription): boolean {
    const end = scheduledEnd(subscription);

    if (end === null) return false;

    const periodEnd = subscription.items.data[0]?.current_period_end;

    // No period to compare against — an unusual subscription with no items. A scheduled stop is the
    // more specific fact of the two, so it wins.
    if (periodEnd === undefined) return true;

    return end <= periodEnd;
}

/**
 * Whether this subscription still has a charge ahead of it. Read plainly: block only if money is
 * still going to move.
 *
 * @remarks
 * An entitling status is necessary but not sufficient, which is why {@link endsWithoutRenewing} is
 * consulted as well. The customer portal cancels at *period end* by default, so a subscription
 * cancelled on 20 March with a billing date of the 5th stays `active` until 5 April — a status check
 * alone would call that user billable when no further charge is coming.
 *
 * `trialing` counts as billable, because a trial converts to a paid charge unless it is cancelled.
 */
function willBillAgain(subscription: Stripe.Subscription): boolean {
    return ENTITLING_STATUSES.has(subscription.status) && !endsWithoutRenewing(subscription);
}

/**
 * Whether a live subscription stands in the way of deleting this account. The gate `deleteAccount`
 * checks before it destroys anything.
 *
 * @remarks
 * This asks Stripe rather than reading `isPro` off the row, and that round trip is the function.
 * `isPro` is only as current as the last webhook that arrived, so a missed delivery leaves the row
 * saying "free" for an account Stripe is still billing — which is precisely the case this gate
 * exists to catch, and precisely the case a local read would wave through.
 *
 * One API call, on an action a user performs about once. An account that never opened checkout has
 * no customer, so the common path costs no call at all.
 */
export async function hasBillableSubscription(userId: string): Promise<boolean> {
    const customerId = await customerIdFor(userId);

    if (!customerId) return false;

    const subscriptions = await stripe().subscriptions.list({
        customer: customerId,
        status: "all",
        limit: 10,
    });

    return subscriptions.data.some(willBillAgain);
}

/**
 * Winds down the billing relationship for an account being deleted: cancels whatever is still
 * running and detaches the stored card, while **keeping the customer**.
 *
 * @remarks
 * The customer record is kept because `customers.del()` destroys the name and email — a deleted
 * customer retrieves as `{ id, deleted: true }` — leaving invoices with nobody attached to them.
 * That costs the ability to reconcile a charge to a person for tax, an answer to "I was charged and
 * my account is gone", and any view of who churned. The concern that deletion addresses is a stored
 * card left attached to someone with no account, and detaching the card is what solves that.
 *
 * Deleting the customer is the response to a GDPR/CCPA erasure request, and Stripe's own
 * recommendation there is a redaction job rather than `customers.del()`, since redaction knows which
 * records must be preserved. That stays the escalation path, not what self-service deletion means.
 *
 * Best-effort throughout, and each step independent: the caller treats a failure as non-fatal,
 * because {@link hasBillableSubscription} has already established that nothing will be charged. A
 * Stripe outage must not stop someone leaving. `resource_missing` is success everywhere — it is the
 * state this function exists to produce.
 */
export async function endBillingRelationship(userId: string): Promise<void> {
    const customerId = await customerIdFor(userId);

    if (!customerId) return;

    // Cancelled *now*, not at period end. The gate has already established that nothing further will
    // be charged, but a subscription scheduled to lapse next month would otherwise sit there live
    // against an account that no longer exists.
    const subscriptions = await forgiving(() =>
        stripe().subscriptions.list({ customer: customerId, status: "all", limit: 100 }),
    );

    for (const subscription of subscriptions?.data ?? []) {
        if (subscription.status === "canceled" || subscription.status === "incomplete_expired") {
            continue;
        }

        await forgiving(() => stripe().subscriptions.cancel(subscription.id));
    }

    // No card stays on file for someone who has no account.
    const paymentMethods = await forgiving(() =>
        stripe().customers.listPaymentMethods(customerId, { limit: 100 }),
    );

    for (const paymentMethod of paymentMethods?.data ?? []) {
        await forgiving(() => stripe().paymentMethods.detach(paymentMethod.id));
    }

    // Metadata rather than deletion, so the dashboard shows what became of the account. Stripe
    // merges metadata on update, so the `userId` written at creation survives — which is what still
    // ties an invoice back to a row that no longer exists.
    await forgiving(() =>
        stripe().customers.update(customerId, {
            metadata: { accountDeletedAt: new Date().toISOString() },
        }),
    );
}

/**
 * Runs one Stripe call, treating "it is already gone" as success.
 *
 * @returns `undefined` on that path, so callers carry on with the next step rather than abandoning
 * the rest of the cleanup — the steps are independent, and a customer whose subscription has
 * vanished still wants its card detached.
 */
async function forgiving<T>(call: () => Promise<T>): Promise<T | undefined> {
    try {
        return await call();
    } catch (error) {
        if ((error as Stripe.errors.StripeError)?.code === "resource_missing") return undefined;

        throw error;
    }
}
