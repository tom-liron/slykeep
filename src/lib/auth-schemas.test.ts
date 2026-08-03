import { describe, expect, it } from "vitest";
import { z } from "zod";

import { changePasswordSchema } from "./auth-schemas";

function fieldErrors(input: unknown) {
    const parsed = changePasswordSchema.safeParse(input);

    if (parsed.success) {
        throw new Error("Expected the schema to reject this input.");
    }

    return z.flattenError(parsed.error).fieldErrors;
}

const valid = {
    currentPassword: "old-password",
    password: "new-password",
    confirmPassword: "new-password",
};

describe("changePasswordSchema", () => {
    it("accepts a matching pair alongside the current password", () => {
        expect(changePasswordSchema.safeParse(valid).success).toBe(true);
    });

    it("reports a mismatch on the confirm field, where the correction is made", () => {
        // Pathed at `confirmPassword` deliberately: attaching it to `password` would mark the box
        // the user most likely typed correctly.
        expect(fieldErrors({ ...valid, confirmPassword: "different" })).toEqual({
            confirmPassword: ["Passwords do not match."],
        });
    });

    it("requires the current password to be present", () => {
        expect(fieldErrors({ ...valid, currentPassword: "" }).currentPassword).toEqual([
            "Enter your current password.",
        ]);
    });

    it("does not apply the new-password rules to the current one", () => {
        // An existing credential predates today's rules; validating it against them would reject an
        // account at the one form that could fix it.
        const short = { ...valid, currentPassword: "short" };

        expect(changePasswordSchema.safeParse(short).success).toBe(true);
    });

    it("enforces the minimum length on the new password", () => {
        const short = { ...valid, password: "short", confirmPassword: "short" };

        expect(fieldErrors(short).password).toEqual(["Password must be at least 8 characters."]);
    });

    it("rejects a new password past bcrypt's 72-byte truncation point", () => {
        // Measured in bytes, not characters: bcrypt silently ignores everything past 72 bytes, so
        // accepting a longer one would sign the user in with a prefix of what they chose. Each "é"
        // is two bytes, making this 73 bytes in 39 characters — which a `.max(72)` on *length*
        // would wave straight through.
        const longPassword = "é".repeat(34) + "abcde";

        expect(new TextEncoder().encode(longPassword).length).toBeGreaterThan(72);
        expect(longPassword.length).toBeLessThan(72);
        expect(
            fieldErrors({ ...valid, password: longPassword, confirmPassword: longPassword })
                .password,
        ).toEqual(["Password must be at most 72 bytes."]);
    });
});
