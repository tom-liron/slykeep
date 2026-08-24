import { z } from "zod";

import { ITEM_TYPE_CATALOG } from "@/config/item-type-catalog";
import type { ItemTypeName } from "@/types/item-type";

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
/** Exported so the AI tag suggestions are filtered against the same bound the schema enforces. */
export const TAG_MAX_LENGTH = 50;
const MAX_TAGS = 20;

/**
 * A bound on how many collections one item may be filed into at once. Nothing caps how many
 * collections an account holds yet, so this is a bound on the *payload* rather than a product limit:
 * the picker submits one id per checkbox, and a hand-made request should not be able to ask for an
 * unbounded `IN (...)` and an unbounded insert.
 */
const MAX_COLLECTIONS = 100;

/**
 * Normalize before validating, for the reason `auth-schemas.ts` spells out: a check that runs first
 * rejects input the trim would have made valid. Blank collapses to `null` rather than `""` so the
 * nullable columns hold one representation of "nothing" instead of two — the view models already
 * turn `null` back into `""` for display.
 */
const blankToNull = (value: unknown) => (typeof value === "string" ? value.trim() || null : value);

const optionalText = z.preprocess(blankToNull, z.string().nullable().optional());

/**
 * A link item's URL, restricted to the two schemes a link is allowed to be.
 *
 * `z.url()` alone validates *shape*, not scheme: it accepts `javascript:`, `data:`, `vbscript:` and
 * `file:` as readily as `https:`, because the WHATWG parser it defers to does. `ItemDrawer` renders
 * the stored value as `href`, so without the `protocol` bound a saved `javascript:` URL executes on
 * this origin the moment the link is clicked — stored XSS, reachable through both the create and the
 * edit path, since both use this field.
 *
 * Only the owner can open their own item's drawer, so today this is self-inflicted. It is bounded
 * anyway because it costs one regular expression, and because it stops being self-inflicted the
 * moment an item is shared or exported into any other surface.
 */
const optionalUrl = z.preprocess(
    blankToNull,
    z
        .url({ protocol: /^https?$/, error: "Enter a valid URL." })
        .nullable()
        .optional(),
);

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

/**
 * The collections an item is filed into, as ids.
 *
 * Blanks are dropped and repeats collapsed for the same reason tags are — the difference is that
 * this list is not typed by hand, so a duplicate is a bug rather than ordinary input. It is still
 * removed rather than rejected: `ItemCollection`'s primary key is `[itemId, collectionId]`, so the
 * same id twice is a unique-constraint violation reported as "could not save your changes" when
 * dropping it costs one `Set`. Deduplication is exact, not case-insensitive: these are ids, and two
 * casings are two different rows rather than two spellings of one.
 *
 * Whether an id is *the caller's* is deliberately not decided here. Only the server knows who is
 * signed in, so `createItem` and `updateItem` check ownership — the same split `fileKey` takes.
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
 * There are no file fields here, deliberately: an uploaded object cannot be replaced from the
 * drawer. Doing so is the one item mutation with an ordering hazard — the old object may only be
 * deleted once the row has committed, or a failed write leaves the item pointing at nothing — and it
 * is not what the spec asked for, so it gets its own change rather than riding along with this one.
 * The edit form shows a file item's object read-only; everything else about the item still edits.
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
 * The types the create dialog offers — now every system type. `file` and `image` were held back
 * until there was something to upload with; `FileUpload` and `POST /api/upload` are that. A unit
 * test pins this list against the catalog, so a type added there is not silently left out here.
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
 * Which content columns a type owns — one rule, read by everything that has to agree on it: the
 * create dialog and the edit form decide which inputs to render from it, and `createItemSchema`
 * strips whatever a type does not own before the payload reaches Prisma. Without that last step the
 * form's field list would be the only thing keeping a link out of the `content` column, which makes
 * a hand-made payload enough to contradict `contentType`.
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
 * Input contract for creating an item from the top bar's dialog.
 *
 * Unlike the edit contract this one carries the type, because choosing it is the whole point of the
 * dialog — and it is the only place a type is ever accepted from a client. Everything downstream of
 * it is derived rather than submitted: the item type's id is resolved by name in the action, and
 * `contentType` comes from the catalog, so a payload cannot claim a URL item holds text.
 *
 * Absent still means absent, exactly as it does for an edit: a note submits no `url` key and the
 * column stays null.
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
        fileSize: z.number().int().positive().nullable().optional(),
        tags,
        collectionIds,
    })
    // A link with no URL is an empty row: `optionalUrl` checks the shape of one that was given, and
    // this is what insists there is one. Only URL types have anywhere to put it.
    .refine((data) => !itemTypeOwns(data.type).url || Boolean(data.url), {
        message: "URL is required.",
        path: ["url"],
    })
    // The same rule for a file: an image with no object is a card that renders nothing. What the key
    // may *be* is not decided here — `createItem` checks it against the signed-in user, because only
    // the server knows who that is.
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
