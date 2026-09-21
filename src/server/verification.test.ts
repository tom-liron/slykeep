import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The property under test is the one thing reusing `VerificationToken` for two purposes can get
 * wrong: a token issued for one purpose must be inert for the other, in both directions and without
 * being destroyed in the process. Everything else here — expiry, single use, the delete-on-reissue —
 * exists because a reset token is a live credential and each of those is what keeps it from
 * outliving its one job.
 *
 * Prisma is replaced with an in-memory stand-in rather than a test database: these are rules about
 * which rows are matched and in what order, not about Postgres.
 */

type TokenRow = { identifier: string; token: string; expires: Date };
type UserRow = { email: string; emailVerified: Date | null };

const db = vi.hoisted(() => ({ tokens: [] as TokenRow[], users: [] as UserRow[] }));

vi.mock("@/server/infra/prisma", () => ({
    prisma: {
        // The real one takes lazily-executed PrismaPromises; the fakes below have already run by
        // the time this is called, so awaiting them is all that is left to do.
        $transaction: (operations: Promise<unknown>[]) => Promise.all(operations),
        verificationToken: {
            create: ({ data }: { data: TokenRow }) => {
                db.tokens.push({ ...data });
                return Promise.resolve(data);
            },
            findUnique: ({ where }: { where: { token: string } }) =>
                Promise.resolve(db.tokens.find((row) => row.token === where.token) ?? null),
            deleteMany: ({ where }: { where: Partial<Pick<TokenRow, "identifier" | "token">> }) => {
                const doomed = db.tokens.filter(
                    (row) =>
                        (where.identifier === undefined || row.identifier === where.identifier) &&
                        (where.token === undefined || row.token === where.token),
                );

                db.tokens = db.tokens.filter((row) => !doomed.includes(row));

                return Promise.resolve({ count: doomed.length });
            },
        },
        user: {
            findUnique: ({ where }: { where: { email: string } }) =>
                Promise.resolve(db.users.find((row) => row.email === where.email) ?? null),
            updateMany: ({
                where,
                data,
            }: {
                where: { email: string; emailVerified?: null };
                data: Partial<UserRow>;
            }) => {
                const matched = db.users.filter(
                    (row) =>
                        row.email === where.email &&
                        (where.emailVerified === undefined || row.emailVerified === null),
                );

                for (const row of matched) Object.assign(row, data);

                return Promise.resolve({ count: matched.length });
            },
        },
    },
}));

const {
    checkPasswordResetToken,
    consumePasswordResetToken,
    createPasswordResetToken,
    createVerificationToken,
    verifyEmailToken,
} = await import("./verification");

const EMAIL = "dev@example.com";

/** Backdates a live token so it reads as expired, without waiting an hour for it. */
function expireAll() {
    for (const row of db.tokens) row.expires = new Date(Date.now() - 1000);
}

beforeEach(() => {
    db.tokens = [];
    db.users = [{ email: EMAIL, emailVerified: null }];
});

describe("purpose isolation", () => {
    it("refuses a verification token at the password-reset endpoint", async () => {
        const token = await createVerificationToken(EMAIL);

        expect(await checkPasswordResetToken(token)).toBe("invalid");
        expect(await consumePasswordResetToken(token)).toEqual({ status: "invalid" });
    });

    it("refuses a reset token at the verification endpoint", async () => {
        const token = await createPasswordResetToken(EMAIL);

        expect(await verifyEmailToken(token)).toEqual({ status: "invalid" });
        expect(db.users[0].emailVerified).toBeNull();
    });

    // The rejection above must not double as a way to cancel the other purpose's links: a token
    // refused here is still perfectly good for what it was issued for.
    it("leaves a rejected token intact for its own purpose", async () => {
        const verification = await createVerificationToken(EMAIL);
        const reset = await createPasswordResetToken(EMAIL);

        await consumePasswordResetToken(verification);
        await verifyEmailToken(reset);

        expect(await verifyEmailToken(verification)).toEqual({ status: "verified", email: EMAIL });
        expect(await consumePasswordResetToken(reset)).toEqual({ status: "valid", email: EMAIL });
    });

    it("keeps the two purposes' tokens alive at the same time", async () => {
        const verification = await createVerificationToken(EMAIL);
        const reset = await createPasswordResetToken(EMAIL);

        // Issued second, so if the delete-on-reissue were scoped to the address alone rather than
        // the address *and* purpose, this is the one that would have wiped the other.
        expect(db.tokens).toHaveLength(2);
        expect(await checkPasswordResetToken(reset)).toBe("valid");
        expect(await verifyEmailToken(verification)).toEqual({ status: "verified", email: EMAIL });
    });
});

describe("reissuing", () => {
    it("invalidates the previous token of the same purpose", async () => {
        const first = await createPasswordResetToken(EMAIL);
        const second = await createPasswordResetToken(EMAIL);

        expect(db.tokens).toHaveLength(1);
        expect(await checkPasswordResetToken(first)).toBe("invalid");
        expect(await checkPasswordResetToken(second)).toBe("valid");
    });
});

describe("password-reset tokens", () => {
    it("returns the address the token was issued for, prefix stripped", async () => {
        const token = await createPasswordResetToken(EMAIL);

        expect(await consumePasswordResetToken(token)).toEqual({ status: "valid", email: EMAIL });
    });

    it("can only be spent once", async () => {
        const token = await createPasswordResetToken(EMAIL);

        expect((await consumePasswordResetToken(token)).status).toBe("valid");
        expect(await consumePasswordResetToken(token)).toEqual({ status: "invalid" });
    });

    it("reports an expired token, and spends it anyway", async () => {
        const token = await createPasswordResetToken(EMAIL);
        expireAll();

        expect(await checkPasswordResetToken(token)).toBe("expired");
        expect(await consumePasswordResetToken(token)).toEqual({ status: "expired" });
        // Left in place, an expired link is a row that can never do anything but be re-read.
        expect(db.tokens).toHaveLength(0);
    });

    it("checks without consuming, so the form it renders can still submit", async () => {
        const token = await createPasswordResetToken(EMAIL);

        expect(await checkPasswordResetToken(token)).toBe("valid");
        expect(await checkPasswordResetToken(token)).toBe("valid");
        expect((await consumePasswordResetToken(token)).status).toBe("valid");
    });

    it("rejects an empty token without touching the table", async () => {
        await createPasswordResetToken(EMAIL);

        expect(await checkPasswordResetToken("")).toBe("invalid");
        expect(db.tokens).toHaveLength(1);
    });
});

describe("verification tokens", () => {
    it("marks the account verified", async () => {
        const token = await createVerificationToken(EMAIL);

        expect(await verifyEmailToken(token)).toEqual({ status: "verified", email: EMAIL });
        expect(db.users[0].emailVerified).toBeInstanceOf(Date);
    });

    it("reports a second click as already verified rather than as a dead link", async () => {
        const first = await createVerificationToken(EMAIL);
        await verifyEmailToken(first);

        const second = await createVerificationToken(EMAIL);

        expect(await verifyEmailToken(second)).toEqual({
            status: "already-verified",
            email: EMAIL,
        });
    });

    // The route handler compares this address against the session to tell a click on one's own
    // expired link from a click on another account's, and offers a different way off the page for
    // each. Dropped here, the second case would silently offer the first account.
    it("names the address an expired link was for", async () => {
        const token = await createVerificationToken(EMAIL);
        expireAll();

        expect(await verifyEmailToken(token)).toEqual({ status: "expired", email: EMAIL });
        expect(db.users[0].emailVerified).toBeNull();
        // Spent all the same: a late click still uses the link up.
        expect(db.tokens).toHaveLength(0);
    });

    it("reads as a dead link when the account is gone", async () => {
        const token = await createVerificationToken(EMAIL);
        db.users = [];

        expect(await verifyEmailToken(token)).toEqual({ status: "invalid" });
    });
});
