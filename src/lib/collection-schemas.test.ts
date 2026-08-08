import { describe, expect, it } from "vitest";

import { createCollectionSchema, type CreateCollectionInput } from "./collection-schemas";

/** The minimum a valid payload needs, so each case can vary one field at a time. */
const base: CreateCollectionInput = { name: "React Patterns" };

function parse(input: CreateCollectionInput) {
    const result = createCollectionSchema.safeParse(input);
    if (!result.success) {
        throw new Error(`Expected the payload to parse: ${result.error.issues[0]?.message}`);
    }

    return result.data;
}

function firstError(input: CreateCollectionInput): string | undefined {
    const result = createCollectionSchema.safeParse(input);

    return result.success ? undefined : result.error.issues[0]?.message;
}

describe("createCollectionSchema", () => {
    describe("name", () => {
        it("trims before checking that it is present", () => {
            expect(parse({ ...base, name: "  Padded  " }).name).toBe("Padded");
        });

        it("rejects a name that is only whitespace", () => {
            // The check has to run *after* the trim, or "   " passes min(1) as three characters.
            expect(firstError({ ...base, name: "   " })).toBe("Name is required.");
        });

        it("rejects an empty name", () => {
            expect(firstError({ ...base, name: "" })).toBe("Name is required.");
        });

        it("accepts a name at the length cap", () => {
            expect(parse({ ...base, name: "x".repeat(100) }).name).toHaveLength(100);
        });

        it("rejects a name past the length cap", () => {
            expect(firstError({ ...base, name: "x".repeat(101) })).toMatch(/at most 100/);
        });
    });

    describe("description", () => {
        it("leaves an omitted description undefined, so the column is not written", () => {
            expect(parse(base).description).toBeUndefined();
        });

        it("turns a blank or whitespace description into null, so nothing is stored as an empty string", () => {
            expect(parse({ ...base, description: "" }).description).toBeNull();
            expect(parse({ ...base, description: "   " }).description).toBeNull();
        });

        it("trims a description that has content", () => {
            expect(parse({ ...base, description: "  Hooks and patterns  " }).description).toBe(
                "Hooks and patterns",
            );
        });

        it("keeps an explicit null as null", () => {
            expect(parse({ ...base, description: null }).description).toBeNull();
        });

        it("does not cap the description, matching Item.description", () => {
            expect(parse({ ...base, description: "x".repeat(5_000) }).description).toHaveLength(
                5_000,
            );
        });
    });

    it("drops keys the contract does not declare, so a payload cannot set isFavorite", () => {
        // `Collection` persists `isFavorite` and `defaultTypeId`, and neither is part of creating
        // one. Zod objects strip unknown keys by default; this pins that, because the action spreads
        // `parsed.data` straight into `prisma.collection.create`.
        const data = parse({ ...base, isFavorite: true } as CreateCollectionInput);

        expect(data).toEqual({ name: "React Patterns" });
    });
});
