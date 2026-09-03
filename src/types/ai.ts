/**
 * The contracts of the four Pro AI features: what an item form hands the model, and what each
 * action hands back.
 *
 * `CreateItemDialog` and `ItemEditForm` pass an {@link ItemDraft} of whatever is currently typed to
 * the actions in `actions/ai.ts`, which check the Pro gate and the rate limit, build a prompt
 * through the matching `lib/ai-*.ts` module, and return one of the four result unions below. The
 * types live here rather than beside the actions because a `"use server"` module may export only
 * async functions.
 */

/**
 * The item being written, as typed right now.
 *
 * Every field is optional and every field is a string the user can see: the forms hand over their
 * inputs, the actions decide what is worth showing the model, and nothing here is stored or
 * otherwise trusted.
 *
 * One shape serves both AI buttons on both forms, so a field a new item type introduces is added
 * once rather than to a draft shape per action.
 *
 * @remarks
 * The fields stay apart rather than collapsing into one content string. A link's URL, a file's name
 * and a snippet's body are not interchangeable to a model asked to describe the item — a file item
 * has only a title and a filename to go on, and folding a URL into `content` loses that it is a URL.
 * Each action folds them together to suit its own prompt.
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
 * The discriminated-union shape the item mutations use, so a caller that has checked `success` reads
 * `data` without a second null check. Every failure is a sentence meant for a toast: the caller
 * never branches on which failure, because a Pro gate, a spent budget and a model that returned
 * nothing all end the same way.
 */
export type SuggestTagsResult =
    { success: true; data: { tags: string[] } } | { success: false; error: string };

/** The generated description, in the same shape and for the same reasons. */
export type SuggestDescriptionResult =
    { success: true; data: { description: string } } | { success: false; error: string };

/**
 * The generated explanation, in the same shape and for the same reasons.
 *
 * @remarks
 * `explanation` is markdown rather than plain text — the only one of the three whose value is
 * rendered rather than put in a field. It is regenerated on each click and never stored, so it
 * reaches no item column.
 */
export type ExplainCodeResult =
    { success: true; data: { explanation: string } } | { success: false; error: string };

/**
 * The optimized prompt, its change list, and whether anything changed at all.
 *
 * `changes` is the account of what was rewritten, which is what turns accept/reject into an informed
 * choice. `unchanged` is a **success**: the model read the prompt and found nothing worth changing,
 * so the caller says so rather than opening a review of a rewrite that is not one.
 *
 * @remarks
 * Unlike an explanation, this value is destined for the item's own `content` column — but only if
 * the user accepts it. The action that produces it writes nothing.
 */
export type OptimizePromptResult =
    | { success: true; data: { prompt: string; changes: string[]; unchanged: boolean } }
    | { success: false; error: string };
