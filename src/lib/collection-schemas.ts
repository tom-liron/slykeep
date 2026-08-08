import { z } from "zod";

/**
 * Input contract for creating a collection from the top bar's dialog.
 *
 * A collection is far simpler than an item: there is no type to choose, so there are no
 * type-specific columns to strip and no `contentType` for a payload to contradict. What is left is
 * the name and an optional description.
 *
 * `isFavorite` and `defaultTypeId` are persisted on `Collection` but are deliberately not accepted
 * here. Neither is part of creating one — favouriting happens afterwards, and a default type is a
 * choice about what an *empty* collection looks like, which `CollectionCard` already handles by
 * rendering a neutral accent when there is no dominant type.
 */

/**
 * Collection names render in the sidebar rail and in card headers, both of which are narrow. The
 * item title's 200 would truncate in every one of those places, so this is tighter on purpose.
 */
const NAME_MAX_LENGTH = 100;

/**
 * Normalize before validating, for the reason `auth-schemas.ts` spells out: a check that runs first
 * rejects input the trim would have made valid. Blank collapses to `null` rather than `""` so the
 * nullable column holds one representation of "nothing" instead of two — the view models already
 * turn `null` back into `""` for display. Same two lines as `item-schemas.ts`, which is a copy worth
 * making: extracting them would couple two otherwise independent contracts through a shared module.
 */
const blankToNull = (value: unknown) => (typeof value === "string" ? value.trim() || null : value);

const optionalText = z.preprocess(blankToNull, z.string().nullable().optional());

export const createCollectionSchema = z.object({
    name: z
        .string()
        .trim()
        .min(1, "Name is required.")
        .max(NAME_MAX_LENGTH, `Name must be at most ${NAME_MAX_LENGTH} characters.`),
    description: optionalText,
});

/**
 * What the dialog submits: raw strings straight from the inputs.
 *
 * Declared by hand rather than inferred with `z.input`, because `z.preprocess` widens its input to
 * `unknown` — which parses fine but would give the one caller that has to build this payload no
 * type checking at all. The same reason `UpdateItemInput` is written out.
 */
export type CreateCollectionInput = {
    name: string;
    description?: string | null;
};

/** The fields an error can be reported against, so the dialog can place a message under one. */
export type CreateCollectionField = keyof CreateCollectionInput;
