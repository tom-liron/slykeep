/**
 * What the AI actions take, and what they hand back.
 *
 * Lives here rather than beside the actions for the reason `UpdateItemResult` and
 * `AccountActionState` do: a `"use server"` module may only export async functions.
 */

/**
 * The item being written, as typed right now.
 *
 * Every field is optional and every field is a *string the user can see*, because that is the whole
 * contract: the forms hand over their inputs, the actions decide what is worth showing the model,
 * and nothing here is stored or trusted with anything.
 *
 * One shape for both AI buttons rather than one each. They render in the same two forms, a few
 * pixels apart, and read almost the same fields — two draft shapes would mean two `draft={...}`
 * props per form to keep in step, and the first thing to drift would be the field a new item type
 * introduces.
 *
 * The fields are kept **apart** rather than collapsed into one "content" string, which is the
 * difference that made this a type instead of a widened parameter list. A link's URL, a file's
 * name, and a snippet's body are not interchangeable to a model asked to describe the item: a file
 * item has *only* a title and a filename to go on, and folding a URL into `content` loses the fact
 * that it is a URL. Each action folds them together in whatever way suits its own prompt.
 */
export type ItemDraft = {
    title?: string;
    content?: string;
    url?: string;
    fileName?: string;
    language?: string;
    tags?: string;
    /** The item type's catalog name. Dropped by the actions unless the catalog recognizes it. */
    type?: string;
};

/**
 * The tag suggestions.
 *
 * The same discriminated-union shape the item mutations use, so a caller that has checked `success`
 * reads `data` without a second null check. Every failure is a sentence meant for a toast — the
 * caller never branches on *which* failure, because a Pro gate, a spent budget, and a model that
 * returned nothing all end the same way: the suggestions did not arrive, and the message says why.
 */
export type SuggestTagsResult =
    { success: true; data: { tags: string[] } } | { success: false; error: string };

/** The generated description, in the same shape and for the same reasons. */
export type SuggestDescriptionResult =
    { success: true; data: { description: string } } | { success: false; error: string };

/**
 * The generated explanation, in the same shape and for the same reasons.
 *
 * `explanation` is **markdown**, not plain text — the only one of the three whose value is rendered
 * rather than put in a field. Nothing is stored: it is regenerated on each click, so it never
 * reaches an item column and no schema knows about it.
 */
export type ExplainCodeResult =
    { success: true; data: { explanation: string } } | { success: false; error: string };
