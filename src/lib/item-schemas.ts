import { z } from "zod";

import { ITEM_TYPE_CATALOG } from "@/config/item-type-catalog";
import { MAX_UPLOAD_BYTES } from "@/lib/file-constraints";
import type { ItemTypeName } from "@/types/item-type";

/**
 * Validation contracts for item create and edit writes, and the rule for which content columns each
 * type owns.
 *
 * The create dialog and the detail drawer submit raw input; `actions/items.ts` parses it with
 * {@link createItemSchema} or {@link updateItemSchema} before writing. {@link itemTypeOwns} is the
 * shared rule the forms build their field list from and the create schema strips against, so a
 * payload cannot populate a column its type does not own and contradict `Item.contentType`. The AI
 * modules in `lib/ai-*.ts` import {@link TAG_MAX_LENGTH} to bound their suggestions to the same
 * limit.
 *
 * @remarks
 * Optional means *absent*, not *empty*. A form renders only the fields its type owns and submits
 * only those, and `undefined` has to parse as "leave this column alone" — which works because
 * Prisma skips `undefined` in a `data` object. Sending `""` instead deliberately clears the column.
 *
 * The item's type is not in the edit contract at all: accepting it would let a payload re-type an
 * item — a snippet into a link — while `contentType` and the populated column stayed as they were.
 */

const TITLE_MAX_LENGTH = 200;

/** A single tag's length limit. Exported so the AI tagger filters its output to the same bound. */
export const TAG_MAX_LENGTH = 50;
const MAX_TAGS = 20;

/**
 * How many collections one payload may file an item into. A bound on the request rather than a
 * product limit — nothing caps how many collections an account holds — so a hand-made request
 * cannot ask for an unbounded `IN (...)` and an unbounded insert.
 */
const MAX_COLLECTIONS = 100;

/**
 * Collapses blank input to `null` before validation, so a leading check cannot reject input the
 * trim would make valid, and the nullable columns hold one representation of "nothing" rather than
 * two. View models turn `null` back into `""` for display. `lib/auth-schemas.ts` spells the
 * ordering out.
 */
const blankToNull = (value: unknown) => (typeof value === "string" ? value.trim() || null : value);

const optionalText = z.preprocess(blankToNull, z.string().nullable().optional());

/**
 * A link item's URL, restricted to the `http` and `https` schemes.
 *
 * @remarks
 * `z.url()` validates shape, not scheme — it accepts `javascript:`, `data:`, `vbscript:` and
 * `file:` because the WHATWG parser it defers to does. `ItemDrawer` renders the stored value as an
 * `href`, so without the `protocol` bound a saved `javascript:` URL executes on this origin when
 * the link is clicked: stored XSS, reachable through both the create and the edit path. Only the
 * owner can open their own item's drawer, so the exposure is self-inflicted today; the bound costs
 * one regular expression and holds once an item is shared or exported into another surface.
 */
const optionalUrl = z.preprocess(
    blankToNull,
    z
        .url({ protocol: /^https?$/, error: "Enter a valid URL." })
        .nullable()
        .optional(),
);

/**
 * Reduces a tag to the form its uniqueness is enforced on: `name.trim().toLowerCase()`.
 *
 * `Tag.name` holds what was typed — `PostgreSQL`, `React` — because that is what every badge
 * renders. `Tag.normalized` holds this value and carries the unique constraint, so one account
 * cannot end up with `react` and `React` as two tags. The write paths `connect` through it too,
 * which is why it is a real column rather than a functional index: `connect` can only target one.
 *
 * Case folding is the only collapsing done. `react` and `reactjs` are different strings and no rule
 * can know they mean the same thing; that is what tag autocomplete is for.
 */
export const normalizeTagName = (name: string): string => name.trim().toLowerCase();

/**
 * Drops blank and duplicate tags from the array the drawer split out of a comma-separated input.
 * `"a,,b"` and `"react, React"` are ordinary typing rather than misuse, so they are cleaned rather
 * than rejected. Deduplication is case-insensitive but keeps the first spelling, matching what the
 * database enforces across submissions: `@@unique([userId, normalized])` means the row for `React`
 * is the row for `react`, so letting both through would connect one tag twice in the `set` below.
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

/**
 * The collections an item is filed into, as ids.
 *
 * Blanks are dropped and exact duplicates collapsed. This list is not typed by hand, so a
 * duplicate is a bug rather than input — but it is still removed rather than rejected:
 * `ItemCollection`'s primary key is `[itemId, collectionId]`, so the same id twice is a
 * unique-constraint violation reported as "could not save your changes" where a `Set` costs
 * nothing. Deduplication is exact, not case-insensitive: these are ids, and two casings are two
 * rows. Whether an id belongs to the caller is decided in `createItem` and `updateItem` — the same
 * split `fileKey` takes — because only the server knows who is signed in.
 */
const collectionIds = z.preprocess(
    (value) => (Array.isArray(value) ? [...new Set(value.filter(Boolean))] : value),
    z.array(z.string()).max(MAX_COLLECTIONS, "That is too many collections.").optional(),
);

const title = z
    .string()
    .trim()
    .min(1, "Title is required.")
    .max(TITLE_MAX_LENGTH, `Title must be at most ${TITLE_MAX_LENGTH} characters.`);

/**
 * The edit contract: everything the drawer can change on an existing item.
 *
 * @remarks
 * No file fields. Replacing an uploaded object from the drawer is the one item mutation with an
 * ordering hazard — the old object may only be deleted once the row has committed, or a failed
 * write leaves the item pointing at nothing — so it is left to its own change. A file item's object
 * shows read-only in the edit form; everything else about the item still edits.
 */
export const updateItemSchema = z.object({
    title,
    description: optionalText,
    content: optionalText,
    language: optionalText,
    url: optionalUrl,
    tags,
    collectionIds,
});

/**
 * What the drawer submits for an edit: raw strings straight from the inputs, with the type-specific
 * fields omitted for an item whose type does not have them.
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
    /**
     * Absent means "leave this item's collections alone"; an empty array means "it belongs to
     * none". The same absent-versus-empty split every other optional field here makes, and the
     * reason the edit form always submits the key — the form is where membership is edited, so an
     * unchecked-everything save has to be able to say so.
     */
    collectionIds?: string[];
};

/** The fields an error can be reported against, so the drawer can place a message under one. */
export type UpdateItemField = keyof UpdateItemInput;

/**
 * The item types the create dialog offers — every system type. A unit test pins this list against
 * {@link ITEM_TYPE_CATALOG}, so a type added there is not silently left out here.
 */
const creatableItemTypeName = z.enum(
    ["snippet", "prompt", "command", "note", "link", "file", "image"],
    { error: "Choose an item type." },
);

export type CreatableItemTypeName = z.infer<typeof creatableItemTypeName>;

export const CREATABLE_ITEM_TYPE_NAMES: readonly CreatableItemTypeName[] =
    creatableItemTypeName.options;

/** The types whose content is code, and so have a language worth declaring. */
const TYPES_WITH_LANGUAGE = new Set<ItemTypeName>(["snippet", "command"]);

/**
 * Which content columns a type owns — one rule, read by everything that has to agree on it. The
 * create dialog and the edit form decide which inputs to render from it, and {@link createItemSchema}
 * strips whatever a type does not own before the payload reaches Prisma. Without that last step the
 * form's field list would be the only thing keeping a link out of the `content` column, which makes
 * a hand-made payload enough to contradict `Item.contentType`.
 */
export function itemTypeOwns(name: ItemTypeName) {
    const { contentType } = ITEM_TYPE_CATALOG[name];

    return {
        content: contentType === "TEXT",
        url: contentType === "URL",
        // The `file` columns travel together — a key with no name would download as a UUID — so one
        // flag covers `fileKey`, `fileName`, and `fileSize`.
        file: contentType === "FILE",
        language: TYPES_WITH_LANGUAGE.has(name),
    };
}

/**
 * The create contract: the fields the top bar's dialog submits, including the item type.
 *
 * This is the only place a client-supplied type is accepted. Everything downstream of it is derived
 * rather than submitted — the item type's id is resolved by name in the action, and `contentType`
 * comes from the catalog — so a payload cannot claim a URL item holds text. Absent still means
 * absent, exactly as it does for an edit: a note submits no `url` key and the column stays null.
 */
export const createItemSchema = z
    .object({
        type: creatableItemTypeName,
        title,
        description: optionalText,
        content: optionalText,
        language: optionalText,
        url: optionalUrl,
        fileKey: optionalText,
        fileName: optionalText,
        // Bounded because this is a claim rather than a measurement. `filePreviewFor` tests it
        // against `TEXT_PREVIEW_MAX_BYTES` to decide whether the drawer renders a file inline, so
        // an unbounded claim of `1` on a 10 MB object would make the drawer fetch the whole thing
        // and hand it to monaco. `createItem` re-derives the key's owner and pins the name's
        // extension to the stored object; the size is owner-only in effect, so the ceiling is the
        // crude `MAX_UPLOAD_BYTES` rather than a comparison against the object itself.
        fileSize: z.number().int().positive().max(MAX_UPLOAD_BYTES).nullable().optional(),
        tags,
        collectionIds,
    })
    // A URL type with no URL is an empty row: `optionalUrl` checks the shape of one that was given,
    // and this insists there is one. Only URL types have anywhere to put it.
    .refine((data) => !itemTypeOwns(data.type).url || Boolean(data.url), {
        message: "URL is required.",
        path: ["url"],
    })
    // The same rule for a file: an image with no object is a card that renders nothing. What the key
    // may *be* is checked in `createItem` against the signed-in user, because only the server knows
    // who that is.
    .refine((data) => !itemTypeOwns(data.type).file || Boolean(data.fileKey), {
        message: "Upload a file first.",
        path: ["fileKey"],
    })
    .transform(
        ({
            type,
            title,
            description,
            tags,
            collectionIds,
            content,
            url,
            language,
            fileKey,
            fileName,
            fileSize,
        }) => {
            const owns = itemTypeOwns(type);

            return {
                type,
                title,
                description,
                tags,
                // Every type can be filed anywhere — a collection holds items of any type — so
                // unlike the content columns there is nothing here to strip by type.
                collectionIds,
                content: owns.content ? content : undefined,
                url: owns.url ? url : undefined,
                language: owns.language ? language : undefined,
                fileKey: owns.file ? fileKey : undefined,
                fileName: owns.file ? fileName : undefined,
                fileSize: owns.file ? fileSize : undefined,
            };
        },
    );

/** What the dialog submits: raw strings, with the fields the selected type does not own omitted. */
export type CreateItemInput = {
    type: CreatableItemTypeName;
    title: string;
    description?: string | null;
    content?: string | null;
    language?: string | null;
    url?: string | null;
    /** The three file columns, as `POST /api/upload` returned them. FILE types only. */
    fileKey?: string | null;
    fileName?: string | null;
    fileSize?: number | null;
    tags?: string[];
    /** The collections to file the new item into. Absent or empty is an item in none. */
    collectionIds?: string[];
};

/** The fields an error can be reported against, so the dialog can mark the input that was rejected. */
export type CreateItemField = keyof CreateItemInput;
