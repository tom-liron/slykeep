import { z } from "zod";

/**
 * Input contract for editing an item from the detail drawer.
 *
 * Every field except the title is optional, and optional here means *absent*, not *empty*. The
 * drawer only renders the fields an item's type owns — a snippet has no URL input, a link has no
 * content textarea — so it only submits those, and `undefined` has to survive parsing as "leave this
 * column alone". Prisma skips `undefined` in a `data` object, which is what makes that work end to
 * end: omitting `url` for a snippet touches nothing, while sending `url: ""` deliberately clears it.
 *
 * The item's type is not here at all. It is not editable, and accepting it would mean a payload
 * could re-type an item — turning a snippet into a link — while `contentType` and the populated
 * content column stayed as they were.
 */

const TITLE_MAX_LENGTH = 200;
const TAG_MAX_LENGTH = 50;
const MAX_TAGS = 20;

/**
 * Normalize before validating, for the reason `auth-schemas.ts` spells out: a check that runs first
 * rejects input the trim would have made valid. Blank collapses to `null` rather than `""` so the
 * nullable columns hold one representation of "nothing" instead of two — the view models already
 * turn `null` back into `""` for display.
 */
const blankToNull = (value: unknown) => (typeof value === "string" ? value.trim() || null : value);

const optionalText = z.preprocess(blankToNull, z.string().nullable().optional());

const optionalUrl = z.preprocess(blankToNull, z.url("Enter a valid URL.").nullable().optional());

/**
 * Tags arrive as an array the drawer split out of a comma-separated input, so blanks ("a,,b") and
 * repeats ("react, React") are ordinary typing rather than misuse — they are dropped rather than
 * rejected. Deduplication is case-insensitive but keeps the first spelling: `Tag.name` is globally
 * unique, so two casings are two rows, and letting both through would also make the `set` below
 * connect the same tag twice.
 */
const normalizeTags = (value: unknown) => {
    if (!Array.isArray(value)) {
        return value;
    }

    const seen = new Set<string>();

    return value.reduce<string[]>((tags, raw) => {
        const name = typeof raw === "string" ? raw.trim() : raw;
        if (typeof name !== "string" || name === "") {
            return tags;
        }

        const key = name.toLowerCase();
        if (!seen.has(key)) {
            seen.add(key);
            tags.push(name);
        }

        return tags;
    }, []);
};

const tags = z.preprocess(
    normalizeTags,
    z
        .array(z.string().max(TAG_MAX_LENGTH, `Tags must be at most ${TAG_MAX_LENGTH} characters.`))
        .max(MAX_TAGS, `An item can have at most ${MAX_TAGS} tags.`)
        .optional(),
);

export const updateItemSchema = z.object({
    title: z
        .string()
        .trim()
        .min(1, "Title is required.")
        .max(TITLE_MAX_LENGTH, `Title must be at most ${TITLE_MAX_LENGTH} characters.`),
    description: optionalText,
    content: optionalText,
    language: optionalText,
    url: optionalUrl,
    tags,
});

/**
 * What the drawer submits: raw strings straight from the inputs, with the type-specific fields
 * omitted for an item whose type does not have them.
 *
 * Declared by hand rather than inferred with `z.input`, because `z.preprocess` widens its input to
 * `unknown` — which parses fine but would give the one caller that has to build this payload no
 * type checking at all.
 */
export type UpdateItemInput = {
    title: string;
    description?: string | null;
    content?: string | null;
    language?: string | null;
    url?: string | null;
    tags?: string[];
};

/** The fields an error can be reported against, so the drawer can place a message under one. */
export type UpdateItemField = keyof UpdateItemInput;
