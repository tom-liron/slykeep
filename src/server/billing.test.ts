import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The three rules in this module that could be wrong in a way nothing else would catch.
 *
 * 1. **What counts as "will bill again".** The gate in front of account deletion. `status ===
 *    "active"` type-checks, passes every other test, and refuses deletion to the users who did
 *    exactly what they were asked — cancel first. That case is the reason these tests exist.
 * 2. **Where the period end is read from.** Stripe moved `current_period_end` off the Subscription
 *    and onto its items in `2025-03-31.basil`. Reading the old location yields `undefined`, which
 *    silently becomes a null column and a panel that cannot say when anything renews.
 * 3. **`resource_missing` is success.** Deleting an already-deleted customer is the outcome the
 *    cleanup exists to produce, and treating it as a failure would log noise on the ordinary path.
 *
 * Stripe and Prisma are both replaced with in-memory stand-ins, the same way `items.test.ts` does
 * it: the question is which arguments go out and which values come back, not how either service
 * answers.
 */

const db = vi.hoisted(() => ({
    findUnique: vi.fn(),
    updateMany: vi.fn(),
    update: vi.fn(),
}));

const api = vi.hoisted(() => ({
    list: vi.fn(),
    del: vi.fn(),
    create: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
    prisma: {
        user: {
            findUnique: db.findUnique,
            updateMany: db.updateMany,
            update: db.update,
        },
    },
}));

vi.mock("@/lib/stripe", () => ({
    stripe: () => ({
        subscriptions: { list: api.list },
        customers: { del: api.del, create: api.create },
    }),
    billingOrigin: () => "https://devstash.test",
}));

vi.mock("@/server/current-user", () => ({
    getCurrentUser: vi.fn(),
    getCurrentUserId: vi.fn(),
}));

const { endBillingRelationship, hasBillableSubscription, syncSubscriptionState } =
    await import("./billing");

/** Only the fields these rules read. The real resource carries some eighty more. */
function subscription(overrides: Record<string, unknown> = {}) {
    return {
        id: "sub_1",
        status: "active",
        cancel_at_period_end: false,
        items: { data: [{ current_period_end: 1_800_000_000, price: { id: "price_monthly" } }] },
        ...overrides,
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    db.updateMany.mockResolvedValue({ count: 1 });
});

describe("hasBillableSubscription", () => {
    it("is false without a Stripe customer, and asks Stripe nothing", async () => {
        db.findUnique.mockResolvedValue({ stripeCustomerId: null });

        expect(await hasBillableSubscription("user_1")).toBe(false);

        // The common path — an account that never opened checkout — must cost no API call.
        expect(api.list).not.toHaveBeenCalled();
    });

    it("is true for a subscription that will be charged again", async () => {
        db.findUnique.mockResolvedValue({ stripeCustomerId: "cus_1" });
        api.list.mockResolvedValue({ data: [subscription()] });

        expect(await hasBillableSubscription("user_1")).toBe(true);
    });

    it("is FALSE for a subscription cancelled at period end, even while it is still active", async () => {
        // The regression test. The portal cancels at period end by default, so someone who cancels
        // on 20 March with a billing date of the 5th sits at `active` with `cancel_at_period_end`
        // until 5 April. They have cancelled; no further charge is coming; deletion must not be
        // refused for another sixteen days.
        db.findUnique.mockResolvedValue({ stripeCustomerId: "cus_1" });
        api.list.mockResolvedValue({ data: [subscription({ cancel_at_period_end: true })] });

        expect(await hasBillableSubscription("user_1")).toBe(false);
    });

    it("is true while trialing, because a trial converts to a charge", async () => {
        db.findUnique.mockResolvedValue({ stripeCustomerId: "cus_1" });
        api.list.mockResolvedValue({ data: [subscription({ status: "trialing" })] });

        expect(await hasBillableSubscription("user_1")).toBe(true);
    });

    it("is true while past_due, because Stripe is still retrying the card", async () => {
        db.findUnique.mockResolvedValue({ stripeCustomerId: "cus_1" });
        api.list.mockResolvedValue({ data: [subscription({ status: "past_due" })] });

        expect(await hasBillableSubscription("user_1")).toBe(true);
    });

    it("is false once the subscription is canceled", async () => {
        db.findUnique.mockResolvedValue({ stripeCustomerId: "cus_1" });
        api.list.mockResolvedValue({ data: [subscription({ status: "canceled" })] });

        expect(await hasBillableSubscription("user_1")).toBe(false);
    });

    it("finds a live subscription behind a dead one", async () => {
        db.findUnique.mockResolvedValue({ stripeCustomerId: "cus_1" });
        api.list.mockResolvedValue({
            data: [subscription({ id: "sub_old", status: "canceled" }), subscription()],
        });

        expect(await hasBillableSubscription("user_1")).toBe(true);
    });
});

describe("syncSubscriptionState", () => {
    it("grants Pro and reads the period end off the subscription ITEM", async () => {
        api.list.mockResolvedValue({ data: [subscription()] });

        await syncSubscriptionState("cus_1");

        expect(db.updateMany).toHaveBeenCalledWith({
            where: { stripeCustomerId: "cus_1" },
            data: {
                isPro: true,
                stripeSubscriptionId: "sub_1",
                stripePriceId: "price_monthly",
                // Seconds in, milliseconds out.
                stripeCurrentPeriodEnd: new Date(1_800_000_000 * 1000),
                stripeCancelAtPeriodEnd: false,
            },
        });
    });

    it("carries cancel_at_period_end through, so the panel can say 'ends' rather than 'renews'", async () => {
        api.list.mockResolvedValue({ data: [subscription({ cancel_at_period_end: true })] });

        await syncSubscriptionState("cus_1");

        expect(db.updateMany.mock.calls[0][0].data).toMatchObject({
            isPro: true,
            stripeCancelAtPeriodEnd: true,
        });
    });

    it("revokes Pro and clears the columns when nothing entitling is left", async () => {
        api.list.mockResolvedValue({ data: [subscription({ status: "canceled" })] });

        await syncSubscriptionState("cus_1");

        expect(db.updateMany.mock.calls[0][0].data).toEqual({
            isPro: false,
            stripeSubscriptionId: null,
            stripePriceId: null,
            stripeCurrentPeriodEnd: null,
            stripeCancelAtPeriodEnd: false,
        });
    });

    it("ignores a subscription that is only an item away from being unreadable", async () => {
        // A subscription with no items should not throw on `data[0]` — it should land as a null
        // period end, the same as no subscription at all.
        api.list.mockResolvedValue({ data: [subscription({ items: { data: [] } })] });

        await syncSubscriptionState("cus_1");

        expect(db.updateMany.mock.calls[0][0].data).toMatchObject({
            isPro: true,
            stripePriceId: null,
            stripeCurrentPeriodEnd: null,
        });
    });

    it("does not throw for a customer this database has never heard of", async () => {
        // `updateMany` matching nothing is the point: `update` would throw P2025 here, answering
        // Stripe with a 500 and earning an endless retry of an event there is nothing to do about.
        api.list.mockResolvedValue({ data: [subscription()] });
        db.updateMany.mockResolvedValue({ count: 0 });

        await expect(syncSubscriptionState("cus_unknown")).resolves.toBeUndefined();
    });
});

describe("endBillingRelationship", () => {
    it("does nothing when there is no customer to remove", async () => {
        db.findUnique.mockResolvedValue({ stripeCustomerId: null });

        await endBillingRelationship("user_1");

        expect(api.del).not.toHaveBeenCalled();
    });

    it("deletes the customer, card and all", async () => {
        db.findUnique.mockResolvedValue({ stripeCustomerId: "cus_1" });
        api.del.mockResolvedValue({ deleted: true });

        await endBillingRelationship("user_1");

        expect(api.del).toHaveBeenCalledWith("cus_1");
    });

    it("treats an already-deleted customer as success", async () => {
        db.findUnique.mockResolvedValue({ stripeCustomerId: "cus_1" });
        api.del.mockRejectedValue(
            Object.assign(new Error("No such customer"), {
                code: "resource_missing",
            }),
        );

        await expect(endBillingRelationship("user_1")).resolves.toBeUndefined();
    });

    it("rethrows anything else, so the caller can log it", async () => {
        db.findUnique.mockResolvedValue({ stripeCustomerId: "cus_1" });
        api.del.mockRejectedValue(Object.assign(new Error("API down"), { code: "api_error" }));

        await expect(endBillingRelationship("user_1")).rejects.toThrow("API down");
    });
});
