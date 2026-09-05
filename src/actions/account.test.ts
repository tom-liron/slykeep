import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The property under test is the ordering of a deletion that spans two systems Postgres cannot hold
 * in one transaction. `deleteAccount` ends a Stripe relationship *before* the row (the cascade
 * destroys the only copy of `stripeCustomerId`) and sweeps R2 *after* it (the objects are keyed by
 * user id, so nothing R2 needs dies with the row — and sweeping first would mean a failed delete had
 * already destroyed a live account's files).
 *
 * Both halves are easy to get subtly wrong in a refactor and impossible to catch by clicking: proving
 * it by hand means a real bucket, a real Stripe customer, and an account you are willing to destroy.
 */

const calls = vi.hoisted(() => ({
    /** Every external effect, in the order it happened. */
    log: [] as string[],
    /** Set to make `prisma.user.delete` reject, standing in for a database that is down. */
    userDeleteFails: false,
    /** The same for the R2 sweep. */
    r2SweepFails: false,
    /** What the Stripe gate answers — the one thing that refuses a deletion outright. */
    billable: false,
}));

vi.mock("@/server/current-user", () => ({
    getCurrentUser: () => Promise.resolve({ id: "user-1", email: "tom@example.com", isPro: false }),
    getCurrentUserId: () => Promise.resolve("user-1"),
}));

vi.mock("@/server/billing", () => ({
    hasBillableSubscription: () => Promise.resolve(calls.billable),
    endBillingRelationship: () => {
        calls.log.push("stripe");

        return Promise.resolve();
    },
}));

vi.mock("@/server/infra/prisma", () => ({
    prisma: {
        user: {
            delete: () => {
                if (calls.userDeleteFails) {
                    return Promise.reject(new Error("database is down"));
                }

                calls.log.push("row");

                return Promise.resolve({ id: "user-1" });
            },
        },
    },
}));

vi.mock("@/server/infra/r2", () => ({
    deleteUserObjects: (userId: string) => {
        calls.log.push(`r2:${userId}`);

        return calls.r2SweepFails
            ? Promise.reject(new Error("R2 is unreachable"))
            : Promise.resolve(2);
    },
}));

vi.mock("@/auth", () => ({
    signOut: () => {
        calls.log.push("sign-out");

        return Promise.resolve();
    },
}));

const { deleteAccount } = await import("./account");

function confirmingWith(value: string): FormData {
    const form = new FormData();

    form.set("confirmation", value);

    return form;
}

describe("deleteAccount", () => {
    beforeEach(() => {
        calls.log = [];
        calls.userDeleteFails = false;
        calls.r2SweepFails = false;
        calls.billable = false;

        vi.spyOn(console, "error").mockImplementation(() => {});
    });

    it("sweeps the account's R2 objects, after the row and before signing out", async () => {
        await deleteAccount({ error: null }, confirmingWith("tom@example.com"));

        expect(calls.log).toEqual(["stripe", "row", "r2:user-1", "sign-out"]);
    });

    it("leaves the files alone when the row delete fails", async () => {
        // The one outcome worse than an orphaned object: an account that still exists and can still
        // be signed into, with its uploads gone.
        calls.userDeleteFails = true;

        await expect(
            deleteAccount({ error: null }, confirmingWith("tom@example.com")),
        ).resolves.toEqual({ error: "Could not delete your account. Try again." });
        expect(calls.log).not.toContain("r2:user-1");
    });

    it("still completes the deletion when the sweep fails", async () => {
        // Best-effort by design: the account is already gone, so a bucket that is briefly unreachable
        // must not report a failure for something that succeeded.
        calls.r2SweepFails = true;

        await deleteAccount({ error: null }, confirmingWith("tom@example.com"));

        expect(calls.log).toEqual(["stripe", "row", "r2:user-1", "sign-out"]);
    });

    it("touches nothing when the typed confirmation does not match", async () => {
        const result = await deleteAccount({ error: null }, confirmingWith("someone@else.com"));

        expect(result.fields?.confirmation).toBe("The email address doesn't match.");
        expect(calls.log).toEqual([]);
    });

    it("accepts the confirmation in any case, since GitHub can supply a mixed-case address", async () => {
        await deleteAccount({ error: null }, confirmingWith("  Tom@Example.com "));

        expect(calls.log).toContain("row");
    });

    it("touches nothing while a subscription would still bill", async () => {
        calls.billable = true;

        const result = await deleteAccount({ error: null }, confirmingWith("tom@example.com"));

        expect(result.error).toMatch(/active Pro subscription/);
        expect(calls.log).toEqual([]);
    });
});
