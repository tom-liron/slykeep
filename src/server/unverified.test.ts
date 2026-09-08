import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The sweep's `where`, clause by clause.
 *
 * This is a scheduled job that deletes user rows, so the tests that matter are the ones asserting
 * what it does **not** delete. Four of the six clauses are guards rather than the rule, and a guard
 * nobody tests is a guard that can be dropped in a refactor without anything going red — right up
 * until a nightly job removes someone's account.
 *
 * Prisma is an in-memory stand-in that applies the `where` the way Prisma would, so the assertions
 * are about which rows match rather than about how Postgres deletes them.
 */

type UserRow = {
    id: string;
    emailVerified: Date | null;
    createdAt: Date;
    password: string | null;
    accounts: number;
    isPro: boolean;
    stripeSubscriptionId: string | null;
};

type UserWhere = {
    emailVerified: null;
    createdAt: { lt: Date };
    password: { not: null };
    accounts: { none: Record<string, never> };
    isPro: boolean;
    stripeSubscriptionId: null;
};

const db = vi.hoisted(() => ({
    users: [] as UserRow[],
    lastWhere: null as UserWhere | null,
}));

vi.mock("@/server/infra/prisma", () => ({
    prisma: {
        user: {
            deleteMany: ({ where }: { where: UserWhere }) => {
                db.lastWhere = where;

                const doomed = db.users.filter(
                    (user) =>
                        user.emailVerified === null &&
                        user.createdAt < where.createdAt.lt &&
                        user.password !== null &&
                        user.accounts === 0 &&
                        user.isPro === false &&
                        user.stripeSubscriptionId === null,
                );

                db.users = db.users.filter((user) => !doomed.includes(user));

                return Promise.resolve({ count: doomed.length });
            },
        },
    },
}));

const { UNVERIFIED_ACCOUNT_TTL_DAYS, sweepUnverifiedAccounts, unverifiedCutoff } =
    await import("./unverified");

const NOW = new Date("2026-09-01T00:00:00.000Z");

function daysAgo(days: number): Date {
    return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);
}

function makeUser(overrides: Partial<UserRow> & { id: string }): UserRow {
    return {
        emailVerified: null,
        createdAt: daysAgo(30),
        password: "hash",
        accounts: 0,
        isPro: false,
        stripeSubscriptionId: null,
        ...overrides,
    };
}

beforeEach(() => {
    db.users = [];
    db.lastWhere = null;
});

describe("unverifiedCutoff", () => {
    it("is the TTL back from now", () => {
        expect(unverifiedCutoff(NOW).toISOString()).toBe("2026-08-25T00:00:00.000Z");
        expect(UNVERIFIED_ACCOUNT_TTL_DAYS).toBe(7);
    });
});

describe("what the sweep deletes", () => {
    it("removes an unconfirmed registration past the TTL", async () => {
        db.users = [makeUser({ id: "abandoned", createdAt: daysAgo(8) })];

        expect(await sweepUnverifiedAccounts(NOW)).toBe(1);
        expect(db.users).toEqual([]);
    });

    // Nothing of the owner's can be lost here: an unconfirmed account is read-only from the moment
    // it exists, so it holds only the starter content it was seeded with.
    it("leaves one inside the TTL alone", async () => {
        db.users = [makeUser({ id: "fresh", createdAt: daysAgo(2) })];

        expect(await sweepUnverifiedAccounts(NOW)).toBe(0);
        expect(db.users.map((user) => user.id)).toEqual(["fresh"]);
    });
});

describe("what the sweep refuses to touch", () => {
    it("a confirmed account, however old", async () => {
        db.users = [
            makeUser({ id: "confirmed", createdAt: daysAgo(400), emailVerified: daysAgo(399) }),
        ];

        expect(await sweepUnverifiedAccounts(NOW)).toBe(0);
        expect(db.users.map((user) => user.id)).toEqual(["confirmed"]);
    });

    // A GitHub sign-up whose `linkAccount` verification write failed sits at `emailVerified: null`
    // and would otherwise look exactly like an abandoned registration.
    it("an account with a linked OAuth account", async () => {
        db.users = [makeUser({ id: "github", createdAt: daysAgo(400), accounts: 1 })];

        expect(await sweepUnverifiedAccounts(NOW)).toBe(0);
        expect(db.users.map((user) => user.id)).toEqual(["github"]);
    });

    it("an OAuth-only account with no password", async () => {
        db.users = [makeUser({ id: "oauth", createdAt: daysAgo(400), password: null })];

        expect(await sweepUnverifiedAccounts(NOW)).toBe(0);
        expect(db.users.map((user) => user.id)).toEqual(["oauth"]);
    });

    // Checkout refuses an unconfirmed address, so neither of these rows should exist. If one ever
    // does, a nightly deletion job must not be what discovers it.
    it("a paying account, by either billing column", async () => {
        db.users = [
            makeUser({ id: "pro", createdAt: daysAgo(400), isPro: true }),
            makeUser({ id: "subscribed", createdAt: daysAgo(400), stripeSubscriptionId: "sub_1" }),
        ];

        expect(await sweepUnverifiedAccounts(NOW)).toBe(0);
        expect(db.users.map((user) => user.id)).toEqual(["pro", "subscribed"]);
    });

    it("keeps every guard in the where clause", async () => {
        await sweepUnverifiedAccounts(NOW);

        expect(db.lastWhere).toMatchObject({
            emailVerified: null,
            password: { not: null },
            accounts: { none: {} },
            isPro: false,
            stripeSubscriptionId: null,
        });
    });
});
