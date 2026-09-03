import { z } from "zod";

/**
 * Validation contracts for collection create and edit writes.
 *
 * `CreateCollectionDialog` and `EditCollectionDialog` submit `{ name, description }`;
 * `actions/collections.ts` parses the payload with {@link createCollectionSchema} or
 * {@link updateCollectionSchema} before writing. A collection has no type, so unlike
 * `lib/item-schemas.ts` there are no type-specific columns to strip and no `contentType` for a
 * payload to contradict.
 *
 * @remarks
 * `Collection.isFavorite` and `Collection.defaultTypeId` are persisted but not accepted here.
 * Favouriting is its own action with its own control; a default type is a choice about what an empty
 * collection looks like, which `CollectionCard` handles by rendering a neutral accent when there is
 * no dominant type. Neither is reachable through these schemas, so a hand-made payload cannot set
 * them.
 */

/**
 * Collection names render in the sidebar rail and in card headers, both narrow, so the ceiling is
 * tighter than an item title's 200.
 */
const NAME_MAX_LENGTH = 100;

/**
 * Collapses blank input to `null` before validation. A check that ran first would reject input the
 * trim makes valid, and `null` rather than `""` keeps one representation of "nothing" in the
 * nullable column — view models turn it back into `""` for display. `lib/auth-schemas.ts` spells
 * the ordering out. The same two lines appear in `lib/item-schemas.ts`; sharing them would couple
 * two independent contracts through one module.
 */
const blankToNull = (value: unknown) => (typeof value === "string" ? value.trim() || null : value);

const optionalText = z.preprocess(blankToNull, z.string().nullable().optional());

/**
 * The fields a collection form owns. Both schemas are built from this rather than one aliasing the
 * other, so a column that later becomes creatable but not editable is added to one object rather
 * than appearing in both by default.
 */
const collectionMetadata = {
    name: z
        .string()
        .trim()
        .min(1, "Name is required.")
        .max(NAME_MAX_LENGTH, `Name must be at most ${NAME_MAX_LENGTH} characters.`),
    description: optionalText,
};

/** The create contract: a required name and an optional description. */
export const createCollectionSchema = z.object(collectionMetadata);

/**
 * The edit contract. Identical to {@link createCollectionSchema} today — the edit dialog changes
 * exactly what creation set — but built separately so the two can diverge without untangling an
 * alias.
 */
export const updateCollectionSchema = z.object(collectionMetadata);

/**
 * What the create dialog submits: raw strings straight from the inputs.
 *
 * Declared by hand rather than inferred with `z.input`, because `z.preprocess` widens its input to
 * `unknown` — which parses fine but would give the one caller that builds this payload no type
 * checking. The same reason `UpdateItemInput` in `lib/item-schemas.ts` is written out.
 */
export type CreateCollectionInput = {
    name: string;
    description?: string | null;
};

/** The fields an error can be reported against, so the dialog can place a message under one. */
export type CreateCollectionField = keyof CreateCollectionInput;

/**
 * What the edit dialog submits — the same two fields as a create, written out separately for the
 * same reason the schemas are.
 *
 * `description` is optional in the payload sense only: the dialog always sends the field, a blank
 * one clears the column, and omitting it entirely would leave the column as it was.
 */
export type UpdateCollectionInput = {
    name: string;
    description?: string | null;
};

export type UpdateCollectionField = keyof UpdateCollectionInput;
