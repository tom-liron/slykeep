import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";

import { cycleForPriceId, priceIdFor } from "@/config/billing";
import { prisma } from "@/server/infra/prisma";
import { stripe } from "@/server/infra/stripe";
import { endBillingRelationship, hasBillableSubscription, syncSubscriptionState } from "./billing";

/**
 * The billing integration, against **real Stripe in test mode**.
 *
 * `billing.test.ts` proves the rules against stand-ins I wrote. That leaves one risk it cannot
 * touch: my stand-in's *shape* may not match what Stripe actually sends. This suite closes it by
 * driving a real subscription through its whole life — created, cancelled at period end,
 * reinstated, cancelled outright — and asserting what our own functions write after each step.
 *
 * It is the cheap substitute for the manual checklist. Clicking through Checkout, the customer
 * portal, and a month of waiting tests mostly *Stripe's* behaviour; this tests ours, in seconds,
 * repeatably, and it fails loudly if a Stripe API change moves a field we read.
 *
 * **It never touches an existing account.** A throwaway user row is created for the run and deleted
 * afterwards, so the demo user — and whatever subscription it is holding — is left alone.
 *
 * Not covered here, deliberately:
 * - `getOrCreateCustomerId` and `getBillingSummary` resolve through `getCurrentUser()`, which needs
 *   a request session. They belong to a browser pass, not to this one.
 * - Webhook signature verification. That is `stripe listen` plus `stripe trigger`, one command each.
 * - `past_due`. Reaching it needs a renewal cycle to fail rather than an API call; that status is in
 *   `ENTITLING_STATUSES` and unit-tested, and the risk here is field shape, not set membership.
 */

// The only stand-in in this file, and it stands in for nothing under test: `server/billing.ts`
// imports `getCurrentUser`, whose own module graph reaches `@/auth` and so `next-auth`, which cannot
// resolve `next/server` outside a Next build. The three functions exercised below take ids as
// arguments and never call it — the two that *do* resolve a session are excluded from this suite for
// that reason, as the header says. Throwing stubs keep that honest: if a refactor ever routes one of
// these through the session, this file fails rather than quietly testing something else.
vi.mock("@/server/current-user", () => ({
    getCurrentUser: () => {
        throw new Error("getCurrentUser is not available in the integration suite.");
    },
    getCurrentUserId: () => {
        throw new Error("getCurrentUserId is not available in the integration suite.");
    },
}));

/** Where the throwaway row and the throwaway customer are tagged, so strays are identifiable. */
const RUN_ID = `billing-test-${Date.now()}`;

let userId: string;
let customerId: string;
let subscriptionId: string;
/** A second Stripe customer that is deliberately never written to the database. */
let strayCustomerId: string;

/** The billing columns as the row currently holds them. */
async function readRow() {
    return prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: {
            isPro: true,
            stripeCustomerId: true,
            stripeSubscriptionId: true,
            stripePriceId: true,
            stripeCurrentPeriodEnd: true,
            stripeCancelAtPeriodEnd: true,
        },
    });
}

beforeAll(async () => {
    // Refusing on a live key is the one guard that matters: everything below creates customers and
    // subscriptions, and doing that against a live account bills real cards.
    const key = process.env.STRIPE_SECRET_KEY;

    if (!key?.startsWith("sk_test_")) {
        throw new Error("Refusing to run: STRIPE_SECRET_KEY must be a test-mode key (sk_test_…).");
    }

    if (process.env.NODE_ENV === "production" || process.env.VERCEL) {
        throw new Error("Refusing to run in a production environment.");
    }

    const customer = await stripe().customers.create({
        email: `${RUN_ID}@slykeep.test`,
        metadata: { purpose: "slykeep billing integration test", runId: RUN_ID },
    });
    customerId = customer.id;

    // A test-mode card, attached and made default, so the subscription lands `active` immediately
    // instead of `incomplete` waiting for payment.
    // `pm_card_visa` is a shared test token, not a PaymentMethod id — attaching it mints a real one
    // for this customer, and it is *that* id the customer must be pointed at.
    const paymentMethod = await stripe().paymentMethods.attach("pm_card_visa", {
        customer: customerId,
    });
    await stripe().customers.update(customerId, {
        invoice_settings: { default_payment_method: paymentMethod.id },
    });

    const subscription = await stripe().subscriptions.create({
        customer: customerId,
        items: [{ price: priceIdFor("monthly") }],
    });
    subscriptionId = subscription.id;

    const stray = await stripe().customers.create({
        email: `${RUN_ID}-stray@slykeep.test`,
        metadata: { purpose: "slykeep billing integration test", runId: RUN_ID },
    });
    strayCustomerId = stray.id;

    const user = await prisma.user.create({
        data: { email: `${RUN_ID}@slykeep.test`, name: "Billing integration test" },
        select: { id: true },
    });
    userId = user.id;

    await prisma.user.update({ where: { id: userId }, data: { stripeCustomerId: customerId } });
});

afterAll(async () => {
    // Best-effort, each independent: a failure part-way through the suite must still clean up the
    // rest rather than leaving both a row and two customers behind.
    if (userId) {
        await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    }

    for (const id of [customerId, strayCustomerId]) {
        if (id)
            await stripe()
                .customers.del(id)
                .catch(() => {});
    }

    await prisma.$disconnect();
});

describe("configuration", () => {
    it("both configured Price ids exist in Stripe, and bill on the cycle they claim", async () => {
        const monthly = await stripe().prices.retrieve(priceIdFor("monthly"));
        const yearly = await stripe().prices.retrieve(priceIdFor("yearly"));

        expect(monthly.active).toBe(true);
        expect(monthly.recurring?.interval).toBe("month");

        expect(yearly.active).toBe(true);
        expect(yearly.recurring?.interval).toBe("year");

        // One product with two prices is what lets the portal offer a monthly↔yearly switch.
        expect(monthly.product).toBe(yearly.product);
    });

    it("maps a real Price id back to its cycle", () => {
        // `cycleForPriceId` reads the same environment the checkout writes from. If these ever
        // disagree, a live subscriber's panel silently loses its plan name.
        expect(cycleForPriceId(priceIdFor("monthly"))).toBe("monthly");
        expect(cycleForPriceId(priceIdFor("yearly"))).toBe("yearly");
    });
});

describe("an active subscription", () => {
    it("grants Pro and records the plan from the real payload", async () => {
        await syncSubscriptionState(customerId);

        const row = await readRow();

        expect(row.isPro).toBe(true);
        expect(row.stripeSubscriptionId).toBe(subscriptionId);
        expect(row.stripePriceId).toBe(priceIdFor("monthly"));
        expect(row.stripeCancelAtPeriodEnd).toBe(false);

        // The assertion this whole suite exists for. `current_period_end` moved off the
        // Subscription onto its items in 2025-03-31.basil; reading the old place yields undefined,
        // which lands as a null column and a panel that cannot say when anything renews. A mock
        // cannot catch that regression — only the real payload can.
        expect(row.stripeCurrentPeriodEnd).toBeInstanceOf(Date);
        expect(row.stripeCurrentPeriodEnd!.getTime()).toBeGreaterThan(Date.now());
    });

    it("is idempotent — the same sync twice leaves the same row", async () => {
        const first = await readRow();
        await syncSubscriptionState(customerId);
        const second = await readRow();

        // The claim that makes webhook retries and out-of-order deliveries safe, and the reason
        // there is no processed-event table.
        expect(second).toEqual(first);
    });

    it("blocks account deletion, because money is still going to move", async () => {
        expect(await hasBillableSubscription(userId)).toBe(true);
    });
});

describe("cancelled at period end", () => {
    beforeAll(async () => {
        // **The shape the customer portal actually produces**, which is not the obvious one and is
        // the reason this block exists in this form. The portal writes `cancel_at` with the period
        // end and leaves `cancel_at_period_end` false; the first version of this suite set the flag
        // instead, passed, and shipped a bug that refused account deletion to anyone who cancelled
        // through the portal — the only way a real user can. Setting `cancel_at` reproduces the real
        // thing; the flag form is covered by the unit tests.
        const current = await stripe().subscriptions.retrieve(subscriptionId);
        const periodEnd = current.items.data[0]!.current_period_end;

        await stripe().subscriptions.update(subscriptionId, { cancel_at: periodEnd });
        await syncSubscriptionState(customerId);
    });

    it("keeps Pro until the paid period runs out", async () => {
        const row = await readRow();

        expect(row.isPro).toBe(true);
        expect(row.stripeCancelAtPeriodEnd).toBe(true);
        // Still a date, and still the one the panel renders — as "ends on", not "renews on".
        expect(row.stripeCurrentPeriodEnd).toBeInstanceOf(Date);
    });

    it("ALLOWS account deletion — the regression this rule exists for", async () => {
        // `ENTITLING_STATUSES.has(status)` alone is still true here: Stripe reports `active` until
        // the period ends. A `status === "active"` gate would refuse this user for weeks after they
        // cancelled exactly as instructed.
        const subscription = await stripe().subscriptions.retrieve(subscriptionId);
        expect(subscription.status).toBe("active");
        // Asserted so the assumption is visible: the flag really is left false by this route, and a
        // gate reading it would wave the user straight into a refusal.
        expect(subscription.cancel_at_period_end).toBe(false);
        expect(subscription.cancel_at).not.toBeNull();

        expect(await hasBillableSubscription(userId)).toBe(false);
    });
});

describe("reinstated", () => {
    it("blocks deletion again once the cancellation is undone", async () => {
        await stripe().subscriptions.update(subscriptionId, { cancel_at: null });
        await syncSubscriptionState(customerId);

        expect((await readRow()).stripeCancelAtPeriodEnd).toBe(false);
        expect(await hasBillableSubscription(userId)).toBe(true);
    });
});

describe("cancelled outright", () => {
    beforeAll(async () => {
        // The end state a test clock would reach by letting the period elapse. Getting there is
        // Stripe's behaviour; what happens to our row afterwards is ours.
        await stripe().subscriptions.cancel(subscriptionId);
        await syncSubscriptionState(customerId);
    });

    it("revokes Pro and clears every plan column", async () => {
        const row = await readRow();

        expect(row.isPro).toBe(false);
        expect(row.stripeSubscriptionId).toBeNull();
        expect(row.stripePriceId).toBeNull();
        expect(row.stripeCurrentPeriodEnd).toBeNull();
        expect(row.stripeCancelAtPeriodEnd).toBe(false);

        // The customer link survives on purpose: it is how a returning subscriber is recognised.
        expect(row.stripeCustomerId).toBe(customerId);
    });

    it("no longer blocks account deletion", async () => {
        expect(await hasBillableSubscription(userId)).toBe(false);
    });
});

describe("a customer this database has never heard of", () => {
    it("syncs without throwing, and changes nothing", async () => {
        // The `updateMany` claim: a customer made by hand in the dashboard, or one whose account
        // has since been deleted. `update` would throw P2025 here, answering Stripe with a 500 and
        // earning an endless retry of an event there is nothing to do about.
        await expect(syncSubscriptionState(strayCustomerId)).resolves.toBeUndefined();

        expect((await readRow()).stripeCustomerId).toBe(customerId);
    });
});

describe("ending the billing relationship", () => {
    beforeAll(async () => {
        // A live subscription again, cancelled the way the portal does it. This is the realistic
        // shape at deletion time: the gate lets a *cancelling* subscriber through, so the cleanup
        // has something still scheduled to wind down rather than something already dead.
        const subscription = await stripe().subscriptions.create({
            customer: customerId,
            items: [{ price: priceIdFor("monthly") }],
        });
        subscriptionId = subscription.id;

        await stripe().subscriptions.update(subscriptionId, {
            cancel_at: subscription.items.data[0]!.current_period_end,
        });

        await endBillingRelationship(userId);
    });

    it("KEEPS the customer, with its name and email intact", async () => {
        // The whole point of the rework. `customers.del()` leaves `{ id, deleted: true }` and
        // nothing else, which strands every invoice with nobody attached to it — no reconciling a
        // charge to a person for tax, no answering "I was charged", no view of who churned.
        const customer = await stripe().customers.retrieve(customerId);

        expect("deleted" in customer && customer.deleted).toBeFalsy();
        expect((customer as Stripe.Customer).email).toBe(`${RUN_ID}@slykeep.test`);
    });

    it("cancels the subscription outright rather than leaving it scheduled", async () => {
        const subscription = await stripe().subscriptions.retrieve(subscriptionId);

        expect(subscription.status).toBe("canceled");
    });

    it("detaches the card, which is the thing that must not outlive the account", async () => {
        const paymentMethods = await stripe().customers.listPaymentMethods(customerId);

        expect(paymentMethods.data).toHaveLength(0);
    });

    it("records what became of the account, keeping the id written at creation", async () => {
        const customer = (await stripe().customers.retrieve(customerId)) as Stripe.Customer;

        expect(customer.metadata.accountDeletedAt).toBeTruthy();
        // Stripe *merges* metadata on update rather than replacing it, which is what the cleanup
        // relies on: in the app the key written at creation is `userId`, and it is what still ties
        // an invoice back to a row that no longer exists. This suite builds its customer directly
        // rather than through `getOrCreateCustomerId` (that needs a session), so the key it can
        // prove the merge with is its own.
        expect(customer.metadata.runId).toBe(RUN_ID);
    });

    it("is safe to run twice, which is the shape of a retry", async () => {
        await expect(endBillingRelationship(userId)).resolves.toBeUndefined();
    });

    it("asks Stripe nothing for an account that never subscribed", async () => {
        await prisma.user.update({ where: { id: userId }, data: { stripeCustomerId: null } });

        expect(await hasBillableSubscription(userId)).toBe(false);
    });
});
