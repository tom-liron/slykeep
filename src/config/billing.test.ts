import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ENTITLING_STATUSES, cycleForPriceId, priceIdFor } from "./billing";

const MONTHLY = "price_monthly_test";
const YEARLY = "price_yearly_test";

/**
 * Both functions read `process.env` at call time — the lazy read that keeps a build possible on a
 * machine holding no Stripe configuration — so each test sets the ids it needs and the environment
 * is restored afterwards.
 */
const original = { ...process.env };

beforeEach(() => {
    process.env.STRIPE_PRICE_ID_MONTHLY = MONTHLY;
    process.env.STRIPE_PRICE_ID_YEARLY = YEARLY;
});

afterEach(() => {
    process.env = { ...original };
});

describe("priceIdFor", () => {
    it("maps each cycle to its configured price", () => {
        expect(priceIdFor("monthly")).toBe(MONTHLY);
        expect(priceIdFor("yearly")).toBe(YEARLY);
    });

    it("throws naming the variable that is missing", () => {
        delete process.env.STRIPE_PRICE_ID_MONTHLY;
        delete process.env.STRIPE_PRICE_ID_YEARLY;

        expect(() => priceIdFor("monthly")).toThrow(/STRIPE_PRICE_ID_MONTHLY/);
        expect(() => priceIdFor("yearly")).toThrow(/STRIPE_PRICE_ID_YEARLY/);
    });
});

describe("cycleForPriceId", () => {
    it("recognizes both configured prices", () => {
        expect(cycleForPriceId(MONTHLY)).toBe("monthly");
        expect(cycleForPriceId(YEARLY)).toBe("yearly");
    });

    it("returns null for an unknown price and for nothing at all", () => {
        expect(cycleForPriceId("price_something_else")).toBeNull();
        expect(cycleForPriceId(null)).toBeNull();
        expect(cycleForPriceId(undefined)).toBeNull();
        expect(cycleForPriceId("")).toBeNull();
    });

    it("returns null rather than throwing when the prices are unconfigured", () => {
        delete process.env.STRIPE_PRICE_ID_MONTHLY;
        delete process.env.STRIPE_PRICE_ID_YEARLY;

        // It runs inside the webhook, where an unrecognizable price is a subscription we cannot
        // label — not a reason to fail a delivery Stripe would then retry for days. An unset
        // variable must not read as a match either, which is what a bare `===` against `undefined`
        // would do if the argument were also undefined.
        expect(cycleForPriceId(MONTHLY)).toBeNull();
        expect(cycleForPriceId(undefined)).toBeNull();
    });
});

describe("ENTITLING_STATUSES", () => {
    it("entitles active and trialing", () => {
        expect(ENTITLING_STATUSES.has("active")).toBe(true);
        expect(ENTITLING_STATUSES.has("trialing")).toBe(true);
    });

    // Asserted explicitly rather than left to the "not in the set" case below: `past_due` is the one
    // member that looks like a mistake to a future reader, so this is where the grace-period
    // decision is recorded in code. A failed payment keeps Pro for as long as Stripe retries —
    // roughly three weeks — because almost all of those are an expired card, not a departure.
    it("entitles past_due, deliberately — it is a grace period, not a cancellation", () => {
        expect(ENTITLING_STATUSES.has("past_due")).toBe(true);
    });

    it("does not entitle a subscription Stripe has given up on or never started", () => {
        expect(ENTITLING_STATUSES.has("canceled")).toBe(false);
        expect(ENTITLING_STATUSES.has("unpaid")).toBe(false);
        expect(ENTITLING_STATUSES.has("incomplete")).toBe(false);
        expect(ENTITLING_STATUSES.has("incomplete_expired")).toBe(false);
        expect(ENTITLING_STATUSES.has("paused")).toBe(false);
    });
});
