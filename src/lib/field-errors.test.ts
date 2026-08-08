import { describe, expect, it } from "vitest";
import { z } from "zod";

import { fieldErrorsOf } from "./field-errors";

/**
 * Two action modules now report validation failures through this, so its behaviour is a contract
 * rather than a detail of whichever one was written first. What matters is that every rejected field
 * gets exactly one message and that nothing crashes on an issue whose path is not a plain field —
 * both of which the actions rely on when they read `Object.values(fields)[0]` for the toast.
 */

/** Errors are what this reads, so each case parses something deliberately invalid. */
function errorOf(schema: z.ZodType, input: unknown): z.ZodError {
    const result = schema.safeParse(input);

    if (result.success) {
        throw new Error("Expected the payload to be rejected.");
    }

    return result.error;
}

describe("fieldErrorsOf", () => {
    it("keys the message by the field it was reported against", () => {
        const schema = z.object({ name: z.string().min(1, "Name is required.") });

        expect(fieldErrorsOf(errorOf(schema, { name: "" }))).toEqual({
            name: "Name is required.",
        });
    });

    it("reports every failing field, not just the first", () => {
        const schema = z.object({
            name: z.string().min(1, "Name is required."),
            url: z.url("Enter a valid URL."),
        });

        expect(fieldErrorsOf(errorOf(schema, { name: "", url: "nope" }))).toEqual({
            name: "Name is required.",
            url: "Enter a valid URL.",
        });
    });

    it("keeps the first message when one field fails twice", () => {
        // The inputs have room for one message each, so a second is dropped rather than
        // concatenated — and which one survives has to be stable, or the toast changes between runs.
        const schema = z.object({
            name: z
                .string()
                .min(5, "Too short.")
                .regex(/^[a-z]+$/, "Letters only."),
        });

        expect(fieldErrorsOf(errorOf(schema, { name: "1" }))).toEqual({ name: "Too short." });
    });

    it("ignores an issue raised against the object rather than a field", () => {
        // A `.refine()` with no `path` reports at the root, where `issue.path` is empty. There is no
        // input to mark, so it is skipped — which is exactly why the actions fall back to a generic
        // sentence when the map comes back empty.
        const schema = z.object({ name: z.string() }).refine(() => false, "Not allowed.");

        expect(fieldErrorsOf(errorOf(schema, { name: "ok" }))).toEqual({});
    });

    it("ignores an issue reported against an array index", () => {
        // `path[0]` is a number for a failing element, which is not a field name the form can point
        // at. `createItemSchema` can produce this — a tag past the length cap.
        const schema = z.array(z.string().max(2, "Too long."));

        expect(fieldErrorsOf(errorOf(schema, ["abc"]))).toEqual({});
    });
});
