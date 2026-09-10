/**
 * Stable toast ids for the controls a user can click faster than a toast expires.
 *
 * Sonner stacks a new toast for every call, which turns a rage-clicked star into a column of
 * identical messages. A call that carries an id sonner is already showing replaces that toast and
 * restarts its timer instead, so a burst of clicks leaves exactly one. Item favourite and pin, the
 * collection star, and the copy failure all pass an id from here.
 *
 * One id per control, shared by that control's success and failure messages: a control has one
 * thing to say at a time, and a refusal should replace the confirmation before it rather than sit
 * beside it. A toast for something that cannot be repeated — a deletion, a sign-in — needs no entry.
 */
export const TOAST_IDS = {
    /** The clipboard failure raised by `copyToClipboard` in `lib/clipboard.ts`. */
    copy: "copy",
    /** `ItemDrawer`'s star, which is the only favourite toggle that reports through a toast. */
    itemFavorite: "item-favorite",
    /** `ItemDrawer`'s pin toggle. */
    itemPin: "item-pin",
    /** `CollectionActions`' star, on collection cards and collection headers. */
    collectionFavorite: "collection-favorite",
} as const;
