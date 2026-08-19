import "server-only";

import type Stripe from "stripe";

import { ENTITLING_STATUSES, cycleForPriceId } from "@/config/billing";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import type { BillingViewModel } from "@/types/view-models";
import { getCurrentUser } from "./current-user";

/**
 * The billing side of an account: its Stripe customer, the entitlement sync the webhook drives, the
 * summary the settings panel renders, and the two helpers account deletion needs.
 *
 * `server/` rather than `actions/` for the sync in particular: a webhook is not a user-initiated
 * mutation and has no form to answer, so it does not belong with the Server Actions
 * (`project-overview.md` §9). The two user-initiated billing flows — checkout and the portal — are
 * Server Actions and live in `actions/billing.ts`.
 */

/**
 * The signed-in account's Stripe customer, created on first use.
 *
 * A customer is created *before* checkout rather than letting Checkout create one, so the webhook
 * has a stable key to find the user by. `checkout.session.completed` carries metadata, but the later
 * `customer.subscription.updated` and `.deleted` events do not — they carry a customer id and
 * nothing else. Without a `stripeCustomerId` already on the row, a cancellation three months from
 * now has nothing to match against.
 *
 * The email is passed so the Stripe dashboard is legible, and the user id goes in metadata so a
 * Customer can be traced back to an account even if the column is somehow lost.
 */
export async function getOrCreateCustomerId(): Promise<string> {
    const user = await getCurrentUser();

    const existing = await prisma.user.findUnique({
        where: { id: user.id },
        select: { stripeCustomerId: true },
    });

    if (existing?.stripeCustomerId) return existing.stripeCustomerId;

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
 * Brings the local entitlement into line with Stripe, for one customer.
 *
 * **Reads the subscription back from the API rather than trusting the event payload.** Webhooks are
 * delivered at least once and in no guaranteed order: an `updated` event can arrive after the
 * `deleted` that superseded it, and a retry of a week-old event can arrive at any time. Deriving
 * state from "whatever Stripe says is true right now" makes both cases harmless, and makes the whole
 * handler idempotent by construction — no event log, no processed-id table.
 *
 * Called by the webhook for all four events it handles, and safe to call from anywhere else.
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

    // `current_period_end` was removed from the Subscription resource in the `2025-03-31.basil` API
    // version and lives on the subscription's *items* now. Reading it off the subscription — which
    // is what every pre-2025 example does, course material included — silently yields undefined.
    const periodEnd = active?.items.data[0]?.current_period_end;
    const priceId = active?.items.data[0]?.price.id ?? null;

    // Whether that date is an expiry rather than a renewal — what stops the panel promising a
    // renewal to someone who has already cancelled and is serving out what they paid for.
    const cancelAtPeriodEnd = active ? endsWithoutRenewing(active) : false;

    await prisma.user.updateMany({
        // `updateMany` rather than `update`: a webhook can name a customer this database has never
        // heard of — one created by hand in the dashboard, or one belonging to an account that has
        // since been deleted — and `update` throws P2025 on no match, which would answer Stripe with
        // a 500 and earn an endless retry of an event there is nothing to do about.
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
 * Built from the local row deliberately: these are the columns the webhook keeps in step with
 * Stripe, and a Stripe round trip on every settings page view to draw a button and a date is not
 * worth it. Only the deletion gate below pays for the truth.
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
 * **There are two shapes for this and they are not interchangeable.** Setting `cancel_at_period_end:
 * true` through the API leaves `cancel_at` null; the *customer portal* does the opposite — it writes
 * `cancel_at` with the period-end timestamp and leaves `cancel_at_period_end` **false**. Reading
 * only the flag, which every example does, therefore misses every cancellation a real user makes,
 * because the portal is the only place they can make one.
 *
 * This was found the hard way: the panel kept saying "Renews on" for a cancelled subscription, and
 * the deletion gate would have refused the user who had just done as they were asked.
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
 * Not simply "is a stop scheduled": `cancel_at` may be set to a date several periods away, and a
 * subscription that renews twice before stopping *is* going to bill again in the meantime. Comparing
 * against the current period's end is what separates "cancelled, serving out what was paid for" from
 * "will keep charging for a while yet".
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
 * Whether this subscription still has a charge ahead of it.
 *
 * Deliberately not `ENTITLING_STATUSES.has(status)` alone. The Stripe customer portal cancels at
 * *period end* by default, so a subscription cancelled on 20 March with a billing date of the 5th
 * stays `active` until 5 April. That user has cancelled and no further charge is coming; refusing
 * their account deletion for another sixteen days would be punishing them for doing exactly what
 * they were told.
 *
 * Which field says so is `endsWithoutRenewing`'s problem, and it is not the obvious one — see there.
 *
 * `trialing` counts, because a trial converts to a paid charge unless it is cancelled.
 *
 * Read plainly: block only if money is still going to move.
 */
function willBillAgain(subscription: Stripe.Subscription): boolean {
    return ENTITLING_STATUSES.has(subscription.status) && !endsWithoutRenewing(subscription);
}

/**
 * Whether a live subscription stands in the way of deleting this account.
 *
 * **Asks Stripe rather than reading `isPro` off the row, and that is the whole point of the
 * function.** `isPro` is only as current as the last webhook that arrived; a missed delivery leaves
 * the row saying "free" for an account Stripe is still billing, and that stale case is precisely
 * the case this gate exists to catch. A gate that trusts local state is a gate that fails exactly
 * when the state is wrong.
 *
 * One API call, on an action a user performs approximately once in their life. An account that never
 * opened checkout has no customer, so the common path costs no API call at all.
 */
export async function hasBillableSubscription(userId: string): Promise<boolean> {
    const row = await prisma.user.findUnique({
        where: { id: userId },
        select: { stripeCustomerId: true },
    });

    if (!row?.stripeCustomerId) return false;

    const subscriptions = await stripe().subscriptions.list({
        customer: row.stripeCustomerId,
        status: "all",
        limit: 10,
    });

    return subscriptions.data.some(willBillAgain);
}

/**
 * Winds down the billing relationship for an account being deleted: cancels whatever is still
 * running and removes the stored card, while **keeping the customer**.
 *
 * The first version of this deleted the customer outright, which is the blunt version of the same
 * idea and the wrong default. `customers.del()` destroys the name and email — a deleted customer
 * retrieves as `{ id, deleted: true }` and nothing else — so invoices survive with no one attached
 * to them. That loses three things a real business needs: the ability to reconcile a charge to a
 * person for tax (records that must typically be kept for years), an answer for "I was charged and
 * my account is gone", and any view of who churned.
 *
 * The concern that motivated deletion was a stored card left attached to someone with no account.
 * That is solved by detaching the card, which is what happens below — the customer record is not the
 * thing holding payment credentials.
 *
 * Deleting the customer is the response to a **GDPR/CCPA erasure request**, and even then Stripe's
 * own recommendation is a redaction job rather than `customers.del()`, because redaction knows which
 * records must be preserved. That stays the escalation path; it is not what self-service account
 * deletion means.
 *
 * Best-effort throughout, and each step independent: the caller treats a failure as non-fatal
 * (`deleteAccount` logs and continues), because `hasBillableSubscription` has already established
 * that nothing will be charged. A Stripe outage must not stop someone leaving. `resource_missing` is
 * success everywhere — it is the state this function exists to produce.
 */
export async function endBillingRelationship(userId: string): Promise<void> {
    const row = await prisma.user.findUnique({
        where: { id: userId },
        select: { stripeCustomerId: true },
    });

    if (!row?.stripeCustomerId) return;

    const customerId = row.stripeCustomerId;

    // Cancelled *now*, not at period end. The gate has already established nothing further will be
    // charged, but a subscription scheduled to lapse next month would otherwise sit there live
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

    // The actual reason this function exists: no card should stay on file for someone who has no
    // account. Detaching is what removes it — deleting the customer was only ever a way to achieve
    // this, at the cost of everything else on the record.
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
 * Returns `undefined` on that path so callers can carry on with the next step rather than abandon
 * the rest of the cleanup — the steps above are independent, and a customer whose subscription has
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
