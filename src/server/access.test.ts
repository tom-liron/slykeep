import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The read-only refusal, against the account states that reach it.
 *
 * This decides whether a write is allowed and what the user is told, so both halves are asserted:
 * that the right accounts are refused, and that the sentence points at the confirmation link rather
 * than at support. What is tested is how this module reads an account through `getCurrentUser` and
 * turns an unconfirmed one into the sentence a Server Action hands back.
 */

const user = vi.hoisted(() => ({
    current: { emailVerified: true },
}));

vi.mock("./current-user", () => ({
    getCurrentUser: () => Promise.resolve(user.current),
}));

const { readOnlyRefusal } = await import("./access");

beforeEach(() => {
    user.current = { emailVerified: true };
});

describe("readOnlyRefusal", () => {
    it("names the action it is refusing, so the message fits the thing just attempted", async () => {
        user.current = { emailVerified: false };

        expect(await readOnlyRefusal("upgrade to Pro")).toContain("upgrade to Pro");
    });

    it("allows a confirmed account", async () => {
        expect(await readOnlyRefusal()).toBeNull();
    });

    it("refuses an unconfirmed one", async () => {
        user.current = { emailVerified: false };

        expect(await readOnlyRefusal()).toContain("Confirm your email");
    });

    // The remedy is one click and nothing has been lost, so the sentence has to say so rather than
    // reading as a permanent denial.
    it("names the remedy rather than the rule", async () => {
        user.current = { emailVerified: false };

        expect(await readOnlyRefusal()).toContain("request a new one");
    });
});
