import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * One rule, and it is the one that trapped a user in a loop.
 *
 * `subscriptionBlocksDeletion` decides which body the delete dialog draws. Deriving it from `isPro`
 * alone means someone who has cancelled — and who keeps Pro until their period ends — is told to
 * cancel a subscription they have already cancelled, every time, with no way out. The question is
 * "will this account be charged again", not "is this account Pro".
 */

const db = vi.hoisted(() => ({
    findUnique: vi.fn(),
    itemCount: vi.fn(),
    collectionCount: vi.fn(),
}));

const session = vi.hoisted(() => ({ user: { id: "user_1", email: "a@b.c", isPro: true } }));

vi.mock("@/server/infra/prisma", () => ({
    prisma: {
        user: { findUnique: db.findUnique },
        item: { count: db.itemCount },
        collection: { count: db.collectionCount },
    },
}));

vi.mock("./current-user", () => ({
    getCurrentUser: () => Promise.resolve(session.user),
    getCurrentUserId: () => Promise.resolve(session.user.id),
}));

vi.mock("./item-types", () => ({ getItemTypeCounts: () => Promise.resolve([]) }));

const { getAccountSettings } = await import("./profile");

beforeEach(() => {
    vi.clearAllMocks();
    db.itemCount.mockResolvedValue(0);
    db.collectionCount.mockResolvedValue(0);
});

describe("getAccountSettings — subscriptionBlocksDeletion", () => {
    it("blocks deletion for a subscription that will renew", async () => {
        session.user = { id: "user_1", email: "a@b.c", isPro: true };
        db.findUnique.mockResolvedValue({ password: "hash", stripeCancelAtPeriodEnd: false });

        expect((await getAccountSettings()).subscriptionBlocksDeletion).toBe(true);
    });

    it("does NOT block deletion once the subscription is cancelling", async () => {
        // The regression. Still Pro — access runs to the period end — but nothing further will be
        // charged, so there is nothing left to cancel and the dialog must offer the real
        // confirmation instead of sending them back to Stripe.
        session.user = { id: "user_1", email: "a@b.c", isPro: true };
        db.findUnique.mockResolvedValue({ password: "hash", stripeCancelAtPeriodEnd: true });

        expect((await getAccountSettings()).subscriptionBlocksDeletion).toBe(false);
    });

    it("does not block a free account", async () => {
        session.user = { id: "user_1", email: "a@b.c", isPro: false };
        db.findUnique.mockResolvedValue({ password: "hash", stripeCancelAtPeriodEnd: false });

        expect((await getAccountSettings()).subscriptionBlocksDeletion).toBe(false);
    });
});
