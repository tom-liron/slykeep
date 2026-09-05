import { describe, expect, it, vi } from "vitest";

/**
 * The sweep's `where`, clause by clause.
 *
 * This is a scheduled job that deletes user rows, so the tests that matter are the ones asserting
 * what it does **not** delete. Three of the six clauses are guards rather than the rule, and a guard
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
    items: number;
    collections: number;
};

type UserWhere = {
    emailVerified: null;
    createdAt: { lt: Date };
    password: { not: null };
    accounts: { none: Record<string, never> };
    items: { none: Record<string, never> };
    collections: { none: Record<string, never> };
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
                    (row) =>
                        row.emailVerified === null &&
                        row.createdAt < where.createdAt.lt &&
                        row.password !== null &&
                        row.accounts === 0 &&
                        row.items === 0 &&
                        row.collections === 0,
                );

                db.users = db.users.filter((row) => !doomed.includes(row));

                return Promise.resolve({ count: doomed.length });
            },
        },
    },
}));

const { UNVERIFIED_ACCOUNT_TTL_DAYS, sweepUnverifiedAccounts, unverifiedCutoff } =
    await import("./unverified");

const NOW = new Date("2026-09-01T00:00:00Z");

function makeUser(overrides: Partial<UserRow> = {}): UserRow {
    return {
        id: "user-1",
        emailVerified: null,
        // Comfortably past the window, so each test varies one thing.
        createdAt: new Date("2026-08-01T00:00:00Z"),
        password: "hashed",
        accounts: 0,
        items: 0,
        collections: 0,
        ...overrides,
    };
}

async function sweep(users: UserRow[]) {
    db.users = users;
    const deleted = await sweepUnverifiedAccounts(NOW);

    return { deleted, survivors: db.users.map((row) => row.id) };
}

describe("unverifiedCutoff", () => {
    it("is the configured number of days behind now", () => {
        expect(unverifiedCutoff(NOW).toISOString()).toBe("2026-08-25T00:00:00.000Z");
        expect(UNVERIFIED_ACCOUNT_TTL_DAYS).toBe(7);
    });
});

describe("sweepUnverifiedAccounts", () => {
    it("deletes an unconfirmed registration past the window", async () => {
        const { deleted, survivors } = await sweep([makeUser({ id: "stale" })]);

        expect(deleted).toBe(1);
        expect(survivors).toEqual([]);
    });

    it("keeps one inside the window", async () => {
        // Registered yesterday: the link may still be sitting unread in an inbox.
        const { deleted, survivors } = await sweep([
            makeUser({ id: "fresh", createdAt: new Date("2026-08-31T00:00:00Z") }),
        ]);

        expect(deleted).toBe(0);
        expect(survivors).toEqual(["fresh"]);
    });

    it("keeps a confirmed account however old it is", async () => {
        const { survivors } = await sweep([
            makeUser({
                id: "verified",
                emailVerified: new Date("2026-01-01T00:00:00Z"),
                createdAt: new Date("2025-01-01T00:00:00Z"),
            }),
        ]);

        expect(survivors).toEqual(["verified"]);
    });

    it("keeps a GitHub account whose verification stamp never landed", async () => {
        // The guard that matters most. `linkAccount` in `src/auth.ts` stamps `emailVerified` as a
        // *second* write after the User and Account rows exist, so a transient failure there leaves
        // a real GitHub account looking exactly like an abandoned registration. The linked account
        // row is what tells them apart.
        const { deleted, survivors } = await sweep([
            makeUser({ id: "github", password: null, accounts: 1 }),
        ]);

        expect(deleted).toBe(0);
        expect(survivors).toEqual(["github"]);
    });

    it("keeps a linked account that also has a password", async () => {
        // Isolates the `accounts` clause from the `password` one. Someone who registered with a
        // password and later signed in with GitHub has both, so the previous test alone would still
        // pass if the linked-account guard were dropped.
        const { deleted, survivors } = await sweep([makeUser({ id: "linked", accounts: 1 })]);

        expect(deleted).toBe(0);
        expect(survivors).toEqual(["linked"]);
    });

    it("keeps an unconfirmed account that somehow owns content", async () => {
        // Should be unreachable — an account that cannot sign in cannot have created anything — and
        // that is exactly why it is a clause rather than a comment. If the reasoning is ever wrong,
        // this refuses instead of cascading someone's items away to prove the point.
        const { survivors } = await sweep([
            makeUser({ id: "has-items", items: 1 }),
            makeUser({ id: "has-collections", collections: 1 }),
        ]);

        expect(survivors).toEqual(["has-items", "has-collections"]);
    });

    it("asks for every guard, not just the age", async () => {
        // Pins the shape of the query itself: a refactor that drops a clause would still pass every
        // test above, because the stand-in only filters on what it is given.
        await sweep([]);

        expect(db.lastWhere).toMatchObject({
            emailVerified: null,
            password: { not: null },
            accounts: { none: {} },
            items: { none: {} },
            collections: { none: {} },
        });
    });
});
