import { describe, expect, it } from "vitest";

import { Prisma } from "@/generated/prisma-client/client";

import { isRecordNotFound } from "./prisma-errors";

const knownRequestError = (code: string) =>
    new Prisma.PrismaClientKnownRequestError("No record was found", {
        code,
        clientVersion: "test",
    });

describe("isRecordNotFound", () => {
    it("recognises Prisma's P2025", () => {
        expect(isRecordNotFound(knownRequestError("P2025"))).toBe(true);
    });

    // The narrowing has to test the code as well as the class. A unique-constraint violation is the
    // same error type, and answering "this no longer exists" to one would be a lie.
    it("rejects a different known request error", () => {
        expect(isRecordNotFound(knownRequestError("P2002"))).toBe(false);
    });

    // Everything a `catch` can actually receive. Each of these must reach the generic arm, which
    // logs — swallowing one as "no longer exists" would hide a real failure from the logs and tell
    // the user their row is gone when it is not.
    it("rejects anything that is not a Prisma known request error", () => {
        expect(isRecordNotFound(new Error("boom"))).toBe(false);
        expect(isRecordNotFound({ code: "P2025" })).toBe(false);
        expect(isRecordNotFound("P2025")).toBe(false);
        expect(isRecordNotFound(null)).toBe(false);
        expect(isRecordNotFound(undefined)).toBe(false);
    });
});
